/**
 * getPendingCounts 云函数 — 获取各类型待审核数量（站内角标用）
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, success, fail, getCollection, requireAdmin } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  // 权限校验：仅管理员
  const admin = await requireAdmin(event);
  if (!admin) {
    return fail('权限不足，仅管理员可操作', -403);
  }

  try {
    const cats = await getCollection(COLLECTIONS.CATS)
      .where({ status: 'pending' })
      .count();

    const edits = await getCollection(COLLECTIONS.EDIT_PROPOSALS)
      .where({ status: 'pending' })
      .count();

    const records = await getCollection(COLLECTIONS.RECORDS)
      .where({ status: 'pending' })
      .count();

    return success({
      cats: cats.total,
      edits: edits.total,
      records: records.total,
      total: cats.total + edits.total + records.total,
    });
  } catch (err) {
    return fail('查询失败：' + err.message);
  }
};
