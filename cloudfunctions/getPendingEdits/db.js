/**
 * 紫喵园 - 云函数公共模块
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const COLLECTIONS = {
  USERS: 'users',
  CATS: 'cats',
  RECORDS: 'records',
  EDIT_PROPOSALS: 'editProposals',
};

const ROLES = {
  ADMIN: 'admin',
  STUDENT: 'student',
};

const CAT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
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

async function isAdmin(openid) {
  const user = await getUserByOpenid(openid);
  return user && user.role === ROLES.ADMIN;
}

async function paginatedQuery(collectionName, {
  where = {},
  page = 1,
  pageSize = 10,
  orderBy = 'createTime',
  order = 'desc',
} = {}) {
  const coll = getCollection(collectionName);
  let query = coll.where(where);
  const countRes = await query.count();
  const total = countRes.total;
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
