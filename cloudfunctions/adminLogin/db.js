/**
 * 紫喵园 - 云函数公共模块（adminLogin）
 *
 * 含密码哈希/校验工具，使用 Node 内置 crypto，无需额外依赖。
 */

const cloud = require('wx-server-sdk');
const crypto = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const COLLECTIONS = {
  ADMINS: 'admins',
  ADMIN_TOKENS: 'adminTokens',
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
 * 哈希密码，存储格式为 `salt:hash`
 * @param {string} password
 * @param {string} salt - 可选，不传则随机生成
 */
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * 校验密码是否匹配
 * @param {string} password - 明文密码
 * @param {string} stored - 存储的 `salt:hash`
 */
function verifyPassword(password, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

module.exports = {
  COLLECTIONS,
  success,
  fail,
  getDB,
  getCollection,
  hashPassword,
  verifyPassword,
};
