/**
 * 紫喵园 - 云函数公共模块
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const COLLECTIONS = {
  USERS: 'users',
  CATS: 'cats',
  RECORDS: 'records',
  ADMIN_TOKENS: 'adminTokens',
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

/**
 * 校验管理员身份（支持网页 token 与小程序 openid 双通道）
 * @param {object} event - 云函数入参
 * @returns {Promise<object|null>} 管理员信息（username）或 null
 */
async function requireAdmin(event = {}) {
  // 网页端：token 校验
  if (event.token) {
    const res = await getCollection(COLLECTIONS.ADMIN_TOKENS)
      .where({ token: event.token })
      .limit(1)
      .get();
    if (res.data.length === 0) return null;
    const t = res.data[0];
    if (new Date(t.expiresAt).getTime() < Date.now()) return null;
    return { username: t.username, via: 'token' };
  }

  // 小程序端：openid 校验（原逻辑）
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return null;
  const user = await getUserByOpenid(OPENID);
  if (!user || user.role !== ROLES.ADMIN) return null;
  return { username: user.nickname || user._openid, via: 'openid' };
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

module.exports = {
  COLLECTIONS,
  ROLES,
  success,
  fail,
  getDB,
  getCollection,
  getUserByOpenid,
  requireAdmin,
  deleteCloudFiles,
};
