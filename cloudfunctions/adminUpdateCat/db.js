/**
 * 紫喵园 - 云函数公共模块
 *
 * 封装数据库操作、权限校验、统一返回格式
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 数据库集合名
const COLLECTIONS = {
  USERS: 'users',
  CATS: 'cats',
  RECORDS: 'records',
  EDIT_PROPOSALS: 'editProposals',
  RELATIONSHIPS: 'relationships',
};

// 用户角色
const ROLES = {
  ADMIN: 'admin',
  STUDENT: 'student',
};

// 猫咪审核状态
const CAT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
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

/**
 * 获取当前用户信息（从 openid 查库）
 * @param {string} openid - 微信 openid
 * @returns {object|null} 用户对象或 null
 */
async function getUserByOpenid(openid) {
  if (!openid) return null;

  const res = await getCollection(COLLECTIONS.USERS)
    .where({ _openid: openid })
    .limit(1)
    .get();

  return res.data.length > 0 ? res.data[0] : null;
}

/**
 * 检查是否为管理员
 * @param {string} openid - 微信 openid
 */
async function isAdmin(openid) {
  const user = await getUserByOpenid(openid);
  return user && user.role === ROLES.ADMIN;
}

/**
 * 分页查询辅助
 * @param {string} collectionName - 集合名
 * @param {object} where - 查询条件
 * @param {number} page - 页码（从1开始）
 * @param {number} pageSize - 每页条数
 * @param {string} orderBy - 排序字段
 * @param {string} order - 'asc' | 'desc'
 */
async function paginatedQuery(collectionName, {
  where = {},
  page = 1,
  pageSize = 10,
  orderBy = 'createTime',
  order = 'desc',
} = {}) {
  const coll = getCollection(collectionName);

  // 构建查询
  let query = coll.where(where);

  // 获取总数
  const countRes = await query.count();
  const total = countRes.total;

  // 分页查询
  const listRes = await query
    .orderBy(orderBy, order)
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  return {
    list: listRes.data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

module.exports = {
  COLLECTIONS,
  ROLES,
  CAT_STATUS,
  success,
  fail,
  getDB,
  getCollection,
  getUserByOpenid,
  isAdmin,
  paginatedQuery,
};
