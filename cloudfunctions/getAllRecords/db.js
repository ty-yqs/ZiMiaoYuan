const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const COLLECTIONS = {
  USERS: 'users',
  CATS: 'cats',
  RECORDS: 'records',
  SETTINGS: 'settings',
};

function success(data = null, message = 'ok') {
  return { code: 0, message, data };
}

function fail(message = 'error', code = -1) {
  return { code, message, data: null };
}

function getDB() {
  return cloud.database();
}

function getCollection(name) {
  return getDB().collection(name);
}

/**
 * 读取全局功能开关（缺失时返回默认值，默认全部开放）
 */
async function getAppSettings() {
  const defaults = { feedOpen: true, recordsOpen: true, notesOpen: true };
  try {
    const res = await getCollection(COLLECTIONS.SETTINGS).doc('global').get();
    if (res && res.data) {
      return {
        feedOpen: res.data.feedOpen !== false,
        recordsOpen: res.data.recordsOpen !== false,
        notesOpen: res.data.notesOpen !== false,
      };
    }
  } catch (e) {
    // 文档不存在或读取失败时走默认值
  }
  return defaults;
}

module.exports = {
  COLLECTIONS,
  success,
  fail,
  getDB,
  getCollection,
  getAppSettings,
};
