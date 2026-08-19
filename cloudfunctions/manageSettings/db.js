const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const COLLECTIONS = {
  USERS: 'users',
  CATS: 'cats',
  RECORDS: 'records',
  BANNERS: 'banners',
  ADMIN_TOKENS: 'adminTokens',
  SETTINGS: 'settings',
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

module.exports = {
  COLLECTIONS,
  ROLES,
  success,
  fail,
  getDB,
  getCollection,
  getUserByOpenid,
  requireAdmin,
};
