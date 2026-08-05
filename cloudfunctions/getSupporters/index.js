/**
 * getSupporters 云函数 — 获取赞助名单
 *
 * 返回按月份分组的最新赞助记录
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, success, fail, getCollection } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  try {
    const res = await getCollection(COLLECTIONS.SUPPORTERS)
      .orderBy('month', 'desc')
      .limit(100)
      .get();

    return success(res.data);
  } catch (err) {
    console.error('[getSupporters] 异常:', err);
    return fail('查询失败：' + err.message);
  }
};
