/**
 * 紫喵园 - 云函数公共模块
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const COLLECTIONS = {
  USERS: 'users',
  CATS: 'cats',
  RECORDS: 'records',
};

const ROLES = {
  ADMIN: 'admin',
  STUDENT: 'student',
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

module.exports = {
  COLLECTIONS,
  ROLES,
  success,
  fail,
  getDB,
  getCollection,
  getUserByOpenid,
};
