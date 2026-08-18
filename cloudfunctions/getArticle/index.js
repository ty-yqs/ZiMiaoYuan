/**
 * getArticle 云函数 — 获取文章详情（公开读）
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, success, fail, getCollection } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { articleId } = event || {};

  if (!articleId) {
    return fail('缺少文章ID');
  }

  try {
    const res = await getCollection(COLLECTIONS.ARTICLES)
      .doc(articleId)
      .get();

    if (!res.data || !res.data._id) {
      return fail('文章不存在');
    }

    return success(res.data);
  } catch (err) {
    console.error('[getArticle] 异常:', err);
    return fail('查询失败：' + err.message);
  }
};
