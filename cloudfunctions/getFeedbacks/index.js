/**
 * getFeedbacks 云函数 — 获取用户反馈列表
 *
 * 仅管理员可调用，按时间倒序返回
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS, ROLES, success, fail, getCollection, getUserByOpenid,
} = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  // 权限校验：仅管理员
  const user = await getUserByOpenid(OPENID);
  if (!user || user.role !== ROLES.ADMIN) {
    return fail('权限不足，仅管理员可操作', -403);
  }

  const { page = 1, pageSize = 20 } = event;

  try {
    const coll = getCollection(COLLECTIONS.FEEDBACKS);

    // 总数
    const countRes = await coll.count();
    const total = countRes.total;

    // 分页查询
    const listRes = await coll
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    // 获取提交者的昵称
    const openids = [...new Set(listRes.data.map(f => f._openid))];
    const userMap = {};

    if (openids.length > 0) {
      const _ = cloud.database().command;
      const usersRes = await getCollection(COLLECTIONS.USERS)
        .where({ _openid: _.in(openids) })
        .field({ _openid: true, nickname: true })
        .get();

      for (const u of usersRes.data) {
        userMap[u._openid] = u.nickname || '未知用户';
      }
    }

    const feedbacks = listRes.data.map(f => ({
      ...f,
      nickname: userMap[f._openid] || '未知用户',
    }));

    return success({
      feedbacks,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });

  } catch (err) {
    console.error('[getFeedbacks] 异常:', err);
    return fail('查询失败：' + err.message);
  }
};
