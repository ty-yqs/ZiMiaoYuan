/**
 * getUsers 云函数 — 管理员分页获取用户列表
 *
 * 支持：昵称关键词搜索、角色筛选、贡献统计（发现猫数 / 记录数）、封禁状态
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

  const { keyword = '', role = '', page = 1, pageSize = 20 } = event;

  try {
    const where = {};
    if (role && ['student', 'admin'].includes(role)) {
      where.role = role;
    }
    if (keyword && keyword.trim()) {
      where.nickname = cloud.database().RegExp({
        regexp: keyword.trim(),
        options: 'i',
      });
    }

    const coll = getCollection(COLLECTIONS.USERS);

    const countRes = await coll.where(where).count();
    const total = countRes.total;

    const listRes = await coll
      .where(where)
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const users = listRes.data;

    // 批量统计贡献（发现的猫数、提交的记录数）
    const stats = await Promise.all(
      users.map(async (u) => {
        const openid = u._openid;
        const [catRes, recordRes] = await Promise.all([
          getCollection(COLLECTIONS.CATS).where({ creator: openid }).count(),
          getCollection(COLLECTIONS.RECORDS).where({ userId: openid }).count(),
        ]);
        return { catCount: catRes.total, recordCount: recordRes.total };
      })
    );

    const list = users.map((u, i) => ({
      _id: u._id,
      _openid: u._openid,
      nickname: u.nickname || '',
      avatar: u.avatar || '',
      role: u.role || 'student',
      banned: !!u.banned,
      createTime: u.createTime,
      lastLoginTime: u.lastLoginTime,
      catCount: stats[i].catCount,
      recordCount: stats[i].recordCount,
    }));

    return success({
      users: list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });

  } catch (err) {
    console.error('[getUsers] 异常:', err);
    return fail('查询失败：' + err.message);
  }
};
