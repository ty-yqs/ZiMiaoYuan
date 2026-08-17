/**
 * adminLogin 云函数 — 后台管理员账号密码登录
 *
 * 与小程序用户体系解耦：管理员账号存在独立的 admins 集合，
 * 登录成功返回一个有时效的 token，后续管理云函数凭 token 鉴权。
 */
const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const { COLLECTIONS, success, fail, getCollection, verifyPassword } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// token 有效期：7 天
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

exports.main = async (event) => {
  const { username, password } = event || {};

  if (!username || !password) {
    return fail('请输入用户名和密码');
  }

  try {
    // 查找管理员
    const adminRes = await getCollection(COLLECTIONS.ADMINS)
      .where({ username: String(username).trim() })
      .limit(1)
      .get();

    if (adminRes.data.length === 0) {
      return fail('用户名或密码错误');
    }

    const admin = adminRes.data[0];
    if (!verifyPassword(String(password), admin.passwordHash)) {
      return fail('用户名或密码错误');
    }

    // 兼容旧账号：无 role 字段视为最高管理员（仅 initAdmin 创建的首个账号），并回填落库
    let role = admin.role;
    if (!role) {
      role = 'super';
      await getCollection(COLLECTIONS.ADMINS).doc(admin._id).update({
        data: { role: 'super' },
      });
    }

    // 生成 token 并落库
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);

    await getCollection(COLLECTIONS.ADMIN_TOKENS).add({
      data: {
        token,
        username: admin.username,
        createTime: now,
        expiresAt,
      },
    });

    // 更新最后登录时间
    await getCollection(COLLECTIONS.ADMINS).doc(admin._id).update({
      data: { lastLoginTime: now },
    });

    return success({
      token,
      username: admin.username,
      role,
      expiresAt: expiresAt.getTime(),
    }, '登录成功');

  } catch (err) {
    console.error('[adminLogin] 异常:', err);
    return fail('登录失败：' + err.message);
  }
};
