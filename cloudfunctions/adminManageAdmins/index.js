/**
 * adminManageAdmins 云函数 — 最高管理员管理后台管理员账号
 *
 * 支持：
 * - list:          列出所有管理员（仅最高管理员）
 * - add:           新增管理员（仅最高管理员，role: admin）
 * - setRole:       提升/降级管理员角色（仅最高管理员，super / admin）
 * - resetPassword: 重置某管理员密码（仅最高管理员）
 * - delete:        删除管理员（仅最高管理员，并清理其 token）
 * - changePassword:修改本人密码（任意管理员，需原密码）
 *
 * 保护规则：
 * - 不能修改/删除自己
 * - 至少保留一名最高管理员
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS, success, fail, getCollection, hashPassword, verifyPassword,
  requireAdmin, requireSuperAdmin, countSupers,
} = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const ACTIONS = ['list', 'add', 'setRole', 'resetPassword', 'delete'];

// 修改本人密码（需校验原密码）
async function changeOwnPassword(event, self) {
  const { oldPassword, newPassword } = event;
  if (!oldPassword || !newPassword) {
    return fail('请填写原密码和新密码');
  }
  if (String(newPassword).length < 6) {
    return fail('新密码至少 6 位');
  }

  const adminsColl = getCollection(COLLECTIONS.ADMINS);
  const adminRes = await adminsColl.doc(self._id).get();
  if (!adminRes.data) {
    return fail('账号不存在');
  }
  if (!verifyPassword(String(oldPassword), adminRes.data.passwordHash)) {
    return fail('原密码错误');
  }

  await adminsColl.doc(self._id).update({
    data: { passwordHash: hashPassword(String(newPassword)) },
  });
  console.log('[adminManageAdmins] 已修改本人密码:', self.username);
  return success(null, '密码已修改');
}

exports.main = async (event) => {
  const { action } = event;

  // 修改本人密码：任意已登录管理员均可，无需最高管理员
  if (action === 'changePassword') {
    const self = await requireAdmin(event);
    if (!self) {
      return fail('权限不足，请先登录', -403);
    }
    try {
      return await changeOwnPassword(event, self);
    } catch (err) {
      console.error('[adminManageAdmins] 修改密码异常:', err);
      return fail('修改密码失败：' + err.message);
    }
  }

  const admin = await requireSuperAdmin(event);
  if (!admin) {
    return fail('权限不足，仅最高管理员可操作', -403);
  }

  if (!ACTIONS.includes(action)) {
    return fail('无效的操作类型，支持：' + ACTIONS.join(' / '));
  }

  try {
    const adminsColl = getCollection(COLLECTIONS.ADMINS);

    if (action === 'list') {
      const res = await adminsColl.limit(1000).get();
      const list = (res.data || []).map((a) => ({
        _id: a._id,
        username: a.username,
        role: a.role || 'super',
        createTime: a.createTime,
        lastLoginTime: a.lastLoginTime || null,
      }));
      return success(list);
    }

    if (action === 'add') {
      const { username, password } = event;
      const name = String(username || '').trim();
      if (!name) return fail('请填写用户名');
      if (!password || String(password).length < 6) return fail('密码至少 6 位');

      const existRes = await adminsColl.where({ username: name }).limit(1).get();
      if (existRes.data.length > 0) return fail('该用户名已存在');

      const now = new Date();
      const addRes = await adminsColl.add({
        data: {
          username: name,
          passwordHash: hashPassword(String(password)),
          role: 'admin',
          createTime: now,
          lastLoginTime: null,
        },
      });

      console.log('[adminManageAdmins] 新增管理员:', name);
      return success({ _id: addRes._id, username: name, role: 'admin' }, '管理员已添加');
    }

    if (action === 'setRole') {
      const { adminId, role } = event;
      if (!adminId) return fail('缺少管理员ID');
      if (!['super', 'admin'].includes(role)) return fail('无效的角色');

      const targetRes = await adminsColl.doc(adminId).get();
      if (!targetRes.data) return fail('管理员不存在');
      const target = targetRes.data;

      if (target.username === admin.username) return fail('不能修改自己的角色');

      // 防止降级最后一个最高管理员
      if ((target.role || 'super') === 'super' && role === 'admin') {
        const superCount = await countSupers(adminsColl);
        if (superCount <= 1) return fail('至少保留一名最高管理员');
      }

      await adminsColl.doc(adminId).update({ data: { role } });
      console.log('[adminManageAdmins] 修改角色:', target.username, '->', role);
      return success(null, '角色已更新');
    }

    if (action === 'resetPassword') {
      const { adminId, password } = event;
      if (!adminId) return fail('缺少管理员ID');
      if (!password || String(password).length < 6) return fail('密码至少 6 位');

      const targetRes = await adminsColl.doc(adminId).get();
      if (!targetRes.data) return fail('管理员不存在');

      await adminsColl.doc(adminId).update({
        data: { passwordHash: hashPassword(String(password)) },
      });
      console.log('[adminManageAdmins] 已重置密码:', targetRes.data.username);
      return success(null, '密码已重置');
    }

    if (action === 'delete') {
      const { adminId } = event;
      if (!adminId) return fail('缺少管理员ID');

      const targetRes = await adminsColl.doc(adminId).get();
      if (!targetRes.data) return fail('管理员不存在');
      const target = targetRes.data;

      if (target.username === admin.username) return fail('不能删除自己');

      // 不能删除最后一个最高管理员
      if ((target.role || 'super') === 'super') {
        const superCount = await countSupers(adminsColl);
        if (superCount <= 1) return fail('至少保留一名最高管理员');
      }

      // 清理该账号的登录 token
      const tokensColl = getCollection(COLLECTIONS.ADMIN_TOKENS);
      const tokensRes = await tokensColl.where({ username: target.username }).limit(1000).get();
      await Promise.all(
        (tokensRes.data || []).map((t) => tokensColl.doc(t._id).remove())
      );

      await adminsColl.doc(adminId).remove();
      console.log('[adminManageAdmins] 已删除管理员:', target.username);
      return success(null, '已删除');
    }

  } catch (err) {
    console.error('[adminManageAdmins] 异常:', err);
    return fail('操作失败：' + err.message);
  }
};
