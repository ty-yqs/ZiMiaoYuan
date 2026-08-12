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
 * 删除云存储文件（批量，自动去重、过滤空值、分批处理）
 * @param {string[]} fileIds - cloud:// 格式的文件 ID 列表
 * @returns {Promise<{deleted: number, failed: number}>}
 */
async function deleteCloudFiles(fileIds = []) {
  const ids = [...new Set((fileIds || []).filter(id => id && id.startsWith('cloud://')))];
  if (ids.length === 0) return { deleted: 0, failed: 0 };

  let deleted = 0;
  let failed = 0;

  // 单次最多删除 50 个文件
  const BATCH_SIZE = 50;
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    try {
      const res = await cloud.deleteFile({ fileList: batch });
      const fileList = res.fileList || [];
      deleted += fileList.filter(f => f.status === 0).length;
      failed += fileList.filter(f => f.status !== 0).length;
    } catch (e) {
      failed += batch.length;
      console.warn('[deleteCloudFiles] 批量删除失败:', e.message);
    }
  }

  return { deleted, failed };
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
  deleteCloudFiles,
};
