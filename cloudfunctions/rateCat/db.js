/**
 * 紫喵园 - 云函数公共模块 (rateCat)
 *
 * 封装数据库操作、统一返回格式
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 数据库集合名
const COLLECTIONS = {
  USERS: 'users',
  CATS: 'cats',
  RATINGS: 'ratings',
};

/**
 * 统一成功返回
 * @param {any} data - 返回数据
 * @param {string} message - 提示信息
 */
function success(data = null, message = 'ok') {
  return { code: 0, message, data };
}

/**
 * 统一失败返回
 * @param {string} message - 错误信息
 * @param {number} code - 错误码
 */
function fail(message = 'error', code = -1) {
  return { code, message, data: null };
}

/**
 * 获取数据库引用
 */
function getDB() {
  return cloud.database();
}

/**
 * 获取集合引用
 * @param {string} name - 集合名
 */
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
