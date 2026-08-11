/**
 * getMySubmissions 云函数 — 获取当前用户的所有提交记录
 *
 * 查询 cats、records、editProposals 三个集合中属于当前用户的记录，
 * 返回各类型的提交列表及审核状态。
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, success, fail, getCollection } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return fail('请先登录');
  }

  try {
    const _ = cloud.database().command;

    // 并行查询三个集合
    const [catsRes, recordsRes, editProposalsRes] = await Promise.all([
      getCollection(COLLECTIONS.CATS)
        .where({ creator: OPENID })
        .orderBy('createTime', 'desc')
        .limit(50)
        .get(),
      getCollection(COLLECTIONS.RECORDS)
        .where({ userId: OPENID })
        .orderBy('createTime', 'desc')
        .limit(50)
        .get(),
      getCollection(COLLECTIONS.EDIT_PROPOSALS)
        .where({ userId: OPENID })
        .orderBy('createTime', 'desc')
        .limit(50)
        .get(),
    ]);

    // 收集所有需要解析名称的 catId
    const catIds = new Set();
    for (const r of recordsRes.data) {
      if (r.catId) catIds.add(r.catId);
    }
    for (const p of editProposalsRes.data) {
      if (p.catId) catIds.add(p.catId);
    }

    // 批量查询猫咪名称
    const catNameMap = {};
    if (catIds.size > 0) {
      const catsRes = await getCollection(COLLECTIONS.CATS)
        .where({ _id: _.in([...catIds]) })
        .field({ cat_name: true })
        .get();

      for (const cat of catsRes.data) {
        catNameMap[cat._id] = cat.cat_name || '未命名猫咪';
      }
    }

    // 为 records 附加猫咪名称；无 status 的旧数据视为 'approved'
    const records = recordsRes.data.map(r => ({
      ...r,
      catName: catNameMap[r.catId] || '未知猫咪',
      status: r.status || 'approved',
    }));

    // 为 editProposals 附加猫咪名称
    const editProposals = editProposalsRes.data.map(p => ({
      ...p,
      catName: catNameMap[p.catId] || '未知猫咪',
    }));

    return success({
      cats: catsRes.data,
      records,
      editProposals,
    });

  } catch (err) {
    console.error('[getMySubmissions] 异常:', err);
    return fail('查询失败：' + err.message);
  }
};
