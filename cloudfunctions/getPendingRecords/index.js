/**
 * getPendingRecords 云函数 — 获取待审核的记录列表
 *
 * 仅管理员可调用
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
    const recordsRes = await getCollection(COLLECTIONS.RECORDS)
      .where({ status: 'pending' })
      .orderBy('createTime', 'desc')
      .limit(50)
      .get();

    // 获取关联的猫咪名称
    const catIds = [...new Set(recordsRes.data.map(r => r.catId))];
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

    const records = recordsRes.data.map(r => ({
      ...r,
      catName: catNameMap[r.catId] || '未知猫咪',
    }));

    return success(records);

  } catch (err) {
    console.error('[getPendingRecords] 异常:', err);
    return fail('查询失败：' + err.message);
  }
};
