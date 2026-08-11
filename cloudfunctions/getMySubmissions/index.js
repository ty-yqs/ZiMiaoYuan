/**
 * getMySubmissions 云函数 — 获取当前用户的所有提交记录
 *
 * 查询 cats、records、editProposals 三个集合中属于当前用户的记录，
 * 返回各类型的提交列表及审核状态。
 *
 * 不传 type 时：返回三个集合的首页数据（兼容旧版）
 * 传 type 时：仅查询指定集合，支持分页
 *
 * @param {string} [type] - 集合类型: 'cats' | 'records' | 'editProposals'
 * @param {number} [page=1] - 页码
 * @param {number} [pageSize=10] - 每页数量
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, success, fail, getCollection } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

/** 查询单个集合并返回分页数据 */
async function queryCollection(collectionName, where, page, pageSize, orderField = 'createTime') {
  const skip = (page - 1) * pageSize;
  const countRes = await getCollection(collectionName).where(where).count();
  const total = countRes.total;
  const res = await getCollection(collectionName)
    .where(where)
    .orderBy(orderField, 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();
  return {
    data: res.data,
    total,
    hasMore: skip + pageSize < total,
  };
}

/** 批量查询猫咪名称映射 */
async function buildCatNameMap(records, edits) {
  const catIds = new Set();
  for (const r of records) { if (r.catId) catIds.add(r.catId); }
  for (const p of edits) { if (p.catId) catIds.add(p.catId); }

  const catNameMap = {};
  if (catIds.size > 0) {
    const _ = cloud.database().command;
    const catsRes = await getCollection(COLLECTIONS.CATS)
      .where({ _id: _.in([...catIds]) })
      .field({ cat_name: true })
      .get();
    for (const cat of catsRes.data) {
      catNameMap[cat._id] = cat.cat_name || '未命名猫咪';
    }
  }
  return catNameMap;
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return fail('请先登录');
  }

  const { type, page = 1, pageSize = 10 } = event;

  try {
    // ========== 指定类型分页查询 ==========
    if (type === 'cats') {
      const result = await queryCollection(COLLECTIONS.CATS, { creator: OPENID }, page, pageSize);
      return success(result);
    }

    if (type === 'records') {
      const result = await queryCollection(COLLECTIONS.RECORDS, { userId: OPENID }, page, pageSize);
      const catNameMap = await buildCatNameMap(result.data, []);
      result.data = result.data.map(r => ({
        ...r,
        catName: catNameMap[r.catId] || '未知猫咪',
        status: r.status || 'approved',
      }));
      return success(result);
    }

    if (type === 'editProposals') {
      const result = await queryCollection(COLLECTIONS.EDIT_PROPOSALS, { userId: OPENID }, page, pageSize);
      const catNameMap = await buildCatNameMap([], result.data);
      result.data = result.data.map(p => ({
        ...p,
        catName: catNameMap[p.catId] || '未知猫咪',
      }));
      return success(result);
    }

    // ========== 无 type：首页全部加载（兼容旧版）==========
    const [catsRes, recordsRes, editProposalsRes] = await Promise.all([
      queryCollection(COLLECTIONS.CATS, { creator: OPENID }, 1, pageSize),
      queryCollection(COLLECTIONS.RECORDS, { userId: OPENID }, 1, pageSize),
      queryCollection(COLLECTIONS.EDIT_PROPOSALS, { userId: OPENID }, 1, pageSize),
    ]);

    const catNameMap = await buildCatNameMap(recordsRes.data, editProposalsRes.data);

    const records = recordsRes.data.map(r => ({
      ...r,
      catName: catNameMap[r.catId] || '未知猫咪',
      status: r.status || 'approved',
    }));

    const editProposals = editProposalsRes.data.map(p => ({
      ...p,
      catName: catNameMap[p.catId] || '未知猫咪',
    }));

    return success({
      cats: { data: catsRes.data, total: catsRes.total, hasMore: catsRes.hasMore },
      records: { data: records, total: recordsRes.total, hasMore: recordsRes.hasMore },
      editProposals: { data: editProposals, total: editProposalsRes.total, hasMore: editProposalsRes.hasMore },
    });

  } catch (err) {
    console.error('[getMySubmissions] 异常:', err);
    return fail('查询失败：' + err.message);
  }
};
