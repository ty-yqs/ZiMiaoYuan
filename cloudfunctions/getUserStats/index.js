/**
 * getUserStats 云函数 — 获取用户贡献统计
 *
 * 返回：
 * - catCount:   用户首次发现的猫咪数量（cats 中 creator === OPENID）
 * - recordCount: 用户所有发现记录数量（records 中 userId === OPENID，含首次+后续）
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
    // 并行查询两个计数
    const [catCountRes, recordCountRes] = await Promise.all([
      getCollection(COLLECTIONS.CATS)
        .where({ creator: OPENID })
        .count(),
      getCollection(COLLECTIONS.RECORDS)
        .where({ userId: OPENID })
        .count(),
    ]);

    return success({
      catCount: catCountRes.total,
      recordCount: recordCountRes.total,
    });

  } catch (err) {
    console.error('[getUserStats] 异常:', err);
    return fail('查询失败：' + err.message);
  }
};
