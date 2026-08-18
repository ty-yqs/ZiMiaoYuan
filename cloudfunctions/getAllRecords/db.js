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

async function getUserByOpenid(openid) {
  if (!openid) return null;
  const res = await getCollection(COLLECTIONS.USERS)
    .where({ _openid: openid })
    .limit(1)
    .get();
  return res.data.length > 0 ? res.data[0] : null;
}

/**
 * 判断是否为「未设置昵称头像」的游客
 */
async function isGuestUser(openid) {
  if (!openid) return true;
  const user = await getUserByOpenid(openid);
  if (!user) return true;
  return !user.nickname || !user.avatar;
}

/**
 * 读取全局功能开关（缺失时返回默认值，默认全部开放）
 */
async function getAppSettings() {
  const defaults = { feedOpen: true, recordsOpen: true, notesOpen: true, guestBrowseOpen: true };
  try {
    const res = await getCollection(COLLECTIONS.SETTINGS).doc('global').get();
    if (res && res.data) {
      return {
        feedOpen: res.data.feedOpen !== false,
        recordsOpen: res.data.recordsOpen !== false,
        notesOpen: res.data.notesOpen !== false,
        guestBrowseOpen: res.data.guestBrowseOpen !== false,
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
  getUserByOpenid,
  isGuestUser,
  getAppSettings,
};
