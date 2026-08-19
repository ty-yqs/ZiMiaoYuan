/**
 * rateCat 云函数 — 猫咪亲人指数评分
 *
 * 一人一猫一条评分记录，支持新增和修改。
 * 每次评分后重算 cats 文档中的 ratingAvg 和 ratingCount。
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, success, fail, getCollection } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return fail('请先登录', -401);
  }

  const { catId, rating } = event;

  // ==================== 参数校验 ====================
  if (!catId) {
    return fail('缺少猫咪ID');
  }

  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return fail('评分必须为 1-5 的整数');
  }

  try {
    const catsColl = getCollection(COLLECTIONS.CATS);
    const ratingsColl = getCollection(COLLECTIONS.RATINGS);
    const now = new Date();

    // ==================== 确认猫咪存在 ====================
    const catRes = await catsColl.doc(catId).get();
    if (!catRes.data) {
      return fail('猫咪不存在');
    }

    // ==================== 检查「公开评分」开关 ====================
    try {
      const settingsRes = await getCollection(COLLECTIONS.SETTINGS).doc('global').get();
      if (settingsRes && settingsRes.data && settingsRes.data.ratingPublicOpen === false) {
        return fail('评分功能暂未开放');
      }
    } catch (e) {
      // 读取失败时不拦截（默认开放）
    }

    // ==================== Upsert 评分记录 ====================
    const existRes = await ratingsColl
      .where({ catId, _openid: OPENID })
      .limit(1)
      .get();

    if (existRes.data.length > 0) {
      // 已有评分 → 更新
      await ratingsColl.doc(existRes.data[0]._id).update({
        data: { rating: ratingNum, updateTime: now },
      });
      console.log('[rateCat] 更新评分:', catId, '用户:', OPENID, '评分:', ratingNum);
    } else {
      // 首次评分 → 新增
      await ratingsColl.add({
        data: {
          catId,
          _openid: OPENID,
          rating: ratingNum,
          createTime: now,
          updateTime: now,
        },
      });
      console.log('[rateCat] 新增评分:', catId, '用户:', OPENID, '评分:', ratingNum);
    }

    // ==================== 聚合重算平均分 ====================
    const aggRes = await ratingsColl
      .aggregate()
      .match({ catId })
      .group({
        _id: null,
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      })
      .end();

    const ratingAvg = aggRes.list.length > 0 ? aggRes.list[0].avgRating : 0;
    const ratingCount = aggRes.list.length > 0 ? aggRes.list[0].count : 0;

    // ==================== 更新猫咪文档 ====================
    await catsColl.doc(catId).update({
      data: {
        ratingAvg,
        ratingCount,
        updateTime: now,
      },
    });

    console.log('[rateCat] 评分完成:', catId, '平均:', ratingAvg, '人数:', ratingCount);

    return success({
      rating: ratingNum,
      ratingAvg,
      ratingCount,
    });

  } catch (err) {
    console.error('[rateCat] 异常:', err);
    return fail('评分失败：' + err.message);
  }
};
