/**
 * getCatDetail 云函数 — 获取猫咪详情 + 关联发现记录
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, success, fail, getCollection } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { catId } = event;

  if (!catId) {
    return fail('缺少猫咪ID');
  }

  try {
    // 查询猫咪档案
    const catRes = await getCollection(COLLECTIONS.CATS)
      .doc(catId)
      .get();

    if (!catRes.data || catRes.data.length === 0) {
      return fail('猫咪不存在');
    }

    const cat = catRes.data;

    // 查询关联的发现记录（按时间倒序）
    const recordsRes = await getCollection(COLLECTIONS.RECORDS)
      .where({ catId })
      .orderBy('createTime', 'desc')
      .limit(50)
      .get();

    // 查询当前用户对该猫的评分
    const { OPENID } = cloud.getWXContext();
    let myRating = 0;
    if (OPENID) {
      const ratingRes = await getCollection(COLLECTIONS.RATINGS)
        .where({ catId, _openid: OPENID })
        .limit(1)
        .get();
      if (ratingRes.data.length > 0) {
        myRating = ratingRes.data[0].rating;
      }
    }

    return success({
      cat,
      records: recordsRes.data,
      recordCount: recordsRes.data.length,
      myRating,
    });

  } catch (err) {
    console.error('[getCatDetail] 异常:', err);
    return fail('查询失败：' + err.message);
  }
};
