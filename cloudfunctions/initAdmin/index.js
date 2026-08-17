/**
 * initAdmin 云函数 — 一次性初始化后台管理员账号
 *
 * 安全性：
 * - initKey 必须与云函数环境变量 ADMIN_INIT_KEY 一致
 * - 仅当 admins 集合为空时允许创建（防止覆盖已有账号）
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, success, fail, getCollection, hashPassword } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { initKey, username, password } = event || {};

  // 校验一次性初始化密钥
  const expectedKey = process.env.ADMIN_INIT_KEY;
  if (!expectedKey || initKey !== expectedKey) {
    return fail('初始化密钥错误', -403);
  }

  if (!username || !password) {
    return fail('请提供用户名和密码');
  }

  try {
    // 仅当 admins 集合为空时允许创建
    const countRes = await getCollection(COLLECTIONS.ADMINS).count();
    if (countRes.total > 0) {
      return fail('已存在管理员账号，禁止重复初始化');
    }

    const now = new Date();
    const usernameTrimmed = String(username).trim();
    const addRes = await getCollection(COLLECTIONS.ADMINS).add({
      data: {
        username: usernameTrimmed,
        passwordHash: hashPassword(String(password)),
        // 首个账号为最高管理员，后续管理员由其在后台添加
        role: 'super',
        createTime: now,
        lastLoginTime: now,
      },
    });

    return success({ id: addRes._id, username: usernameTrimmed }, '管理员创建成功');
  } catch (err) {
    console.error('[initAdmin] 异常:', err);
    return fail('初始化失败：' + err.message);
  }
};
