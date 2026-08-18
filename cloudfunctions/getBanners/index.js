/**
 * getBanners 云函数 — 获取首页轮播头图（公开读）
 *
 * 仅返回启用中的头图，按 sort 升序、createTime 升序排列。
 * image 字段保持 cloud:// fileID，由小程序端用 imageCache 解析。
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, success, fail, getCollection } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  try {
    const res = await getCollection(COLLECTIONS.BANNERS)
      .where({ enabled: true })
      .orderBy('sort', 'asc')
      .orderBy('createTime', 'asc')
      .limit(100)
      .get();

    return success(res.data);
  } catch (err) {
    console.error('[getBanners] 异常:', err);
    return fail('查询失败：' + err.message);
  }
};
