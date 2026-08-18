/**
 * getSettings 云函数 — 获取全局功能开关（公开读）
 *
 * 返回 { feedOpen, recordsOpen, notesOpen }，缺失时默认全部开放。
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, success, getCollection } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  const defaults = { feedOpen: true, recordsOpen: true, notesOpen: true };
  try {
    const res = await getCollection(COLLECTIONS.SETTINGS).doc('global').get();
    if (res && res.data) {
      return success({
        feedOpen: res.data.feedOpen !== false,
        recordsOpen: res.data.recordsOpen !== false,
        notesOpen: res.data.notesOpen !== false,
      });
    }
    return success({ ...defaults });
  } catch (err) {
    // 集合/文档不存在或读取失败时返回默认值
    return success({ ...defaults });
  }
};
