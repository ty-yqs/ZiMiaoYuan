/**
 * 紫喵园 - 云函数公共模块（adminManageAdmins）
 *
 * 含密码哈希/校验工具与管理员鉴权，使用 Node 内置 crypto，无需额外依赖。
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

/**
 * 校验管理员身份（仅网页 token 通道）
 *
 * 兼容旧账号：无 role 字段视为最高管理员（首个 initAdmin 创建的账号）。
 * @returns {Promise<object|null>} { _id, username, role } 或 null
 */
async function requireAdmin(event = {}) {
  if (!event.token) return null;

  const tokenRes = await getCollection(COLLECTIONS.ADMIN_TOKENS)
    .where({ token: event.token })
    .limit(1)
    .get();
  if (tokenRes.data.length === 0) return null;
  const t = tokenRes.data[0];
  if (new Date(t.expiresAt).getTime() < Date.now()) return null;

  const adminRes = await getCollection(COLLECTIONS.ADMINS)
    .where({ username: t.username })
    .limit(1)
    .get();
  if (adminRes.data.length === 0) return null;
  const admin = adminRes.data[0];

  return { _id: admin._id, username: admin.username, role: admin.role || 'super' };
}

/**
 * 校验最高管理员身份（仅 role 为 super 的管理员）
 */
async function requireSuperAdmin(event = {}) {
  const admin = await requireAdmin(event);
  if (!admin) return null;
  // 仅当 role 显式为非 super 时拒绝；旧账号缺失 role 视为 super
  if (admin.role && admin.role !== 'super') return null;
  return admin;
}

/**
 * 统计最高管理员数量（含 role 缺失的旧账号）
 */
async function countSupers(adminsColl) {
  const res = await adminsColl.limit(1000).get();
  return (res.data || []).filter((a) => !a.role || a.role === 'super').length;
}

module.exports = {
  COLLECTIONS,
  success,
  fail,
  getDB,
  getCollection,
  hashPassword,
  verifyPassword,
  requireAdmin,
  requireSuperAdmin,
  countSupers,
};
