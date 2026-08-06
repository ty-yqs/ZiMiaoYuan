/**
 * getPendingEdits 云函数 — 获取待审核的编辑提案
 *
 * 仅管理员可调用，返回所有 pending 状态的编辑提案
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS, ROLES, success, fail, getCollection, getUserByOpenid,
} = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  // 权限校验：仅管理员
  const user = await getUserByOpenid(OPENID);
  if (!user || user.role !== ROLES.ADMIN) {
    return fail('权限不足，仅管理员可操作', -403);
  }

  try {
    // 获取所有待审核的编辑提案
    const proposalsRes = await getCollection(COLLECTIONS.EDIT_PROPOSALS)
      .where({ status: 'pending' })
      .orderBy('createTime', 'desc')
      .limit(50)
      .get();

    // 获取关联的猫咪名称
    const catIds = [...new Set(proposalsRes.data.map(p => p.catId))];
    const catNameMap = {};

    if (catIds.length > 0) {
      const _ = cloud.database().command;
      const catsRes = await getCollection(COLLECTIONS.CATS)
        .where({ _id: _.in(catIds) })
        .field({ cat_name: true })
        .get();

      for (const cat of catsRes.data) {
        catNameMap[cat._id] = cat.cat_name || '未命名猫咪';
      }
    }

    // 附加猫咪名称
    const proposals = proposalsRes.data.map(p => ({
      ...p,
      catName: catNameMap[p.catId] || '未知猫咪',
    }));

    return success(proposals);

  } catch (err) {
    console.error('[getPendingEdits] 异常:', err);
    return fail('查询失败：' + err.message);
  }
};
