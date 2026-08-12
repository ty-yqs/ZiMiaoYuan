const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const COLLECTIONS = {
  USERS: 'users',
  CATS: 'cats',
  RECORDS: 'records',
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

module.exports = {
  COLLECTIONS,
  success,
  fail,
  getDB,
  getCollection,
};
