/**
 * updateUser 云函数 — 更新用户昵称和头像
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, success, fail, getCollection } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return fail('请先登录');
  }

  const { nickname, avatar } = event;

  if (!nickname && !avatar) {
    return fail('请至少提供昵称或头像');
  }

  try {
    const usersColl = getCollection(COLLECTIONS.USERS);
    const userRes = await usersColl.where({ _openid: OPENID }).limit(1).get();

    if (userRes.data.length === 0) {
      return fail('用户不存在');
    }

    const updates = {};
    if (nickname !== undefined) updates.nickname = nickname;
    if (avatar !== undefined) updates.avatar = avatar;

    await usersColl.doc(userRes.data[0]._id).update({ data: updates });

    // 返回更新后的用户对象
    const updated = { ...userRes.data[0], ...updates };
    return success(updated, '更新成功');

  } catch (err) {
    console.error('[updateUser] 异常:', err);
    return fail('更新失败：' + err.message);
  }
};
