/**
 * adminUpdateUser 云函数 — 管理员操作用户
 *
 * 支持：
 * - setRole:   修改用户角色（student / admin）
 * - setBanned: 封禁 / 解封用户
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS, success, fail, getCollection, requireAdmin,
} = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  // 权限校验：仅管理员
  const admin = await requireAdmin(event);
  if (!admin) {
    return fail('权限不足，仅管理员可操作', -403);
  }

  const { userId, action } = event;

  if (!userId || !['setRole', 'setBanned'].includes(action)) {
    return fail('参数错误');
  }

  try {
    const usersColl = getCollection(COLLECTIONS.USERS);
    const userRes = await usersColl.doc(userId).get();
    if (!userRes.data) {
      return fail('用户不存在');
    }

    if (action === 'setRole') {
      const { role } = event;
      if (!['student', 'admin'].includes(role)) {
        return fail('角色必须为 student 或 admin');
      }
      await usersColl.doc(userId).update({ data: { role } });
      console.log('[adminUpdateUser] 角色已修改:', userId, '->', role);
      return success({ role }, role === 'admin' ? '已设为管理员' : '已设为普通用户');
    }

    if (action === 'setBanned') {
      const banned = !!event.banned;
      await usersColl.doc(userId).update({ data: { banned } });
      console.log('[adminUpdateUser] 封禁状态已修改:', userId, banned ? '封禁' : '解封');
      return success({ banned }, banned ? '已封禁' : '已解封');
    }

  } catch (err) {
    console.error('[adminUpdateUser] 异常:', err);
    return fail('操作失败：' + err.message);
  }
};
