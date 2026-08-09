/**
 * login 云函数 — 用户登录 & 自动注册
 *
 * 流程：
 * 1. 获取微信 openid
 * 2. 查找用户 → 存在则返回
 * 3. 不存在则自动创建新用户（默认角色：student）
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, success, fail, getCollection } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  let { OPENID } = cloud.getWXContext();

  //云端测试面板没有微信上下文，允许传入 mock openid
  if (!OPENID && event._testOpenid) {
    OPENID = event._testOpenid;
  }

  if (!OPENID) {
    return fail('获取 openid 失败（请通过小程序前端调用，或传入 _testOpenid）');
  }

  try {
    const usersColl = getCollection(COLLECTIONS.USERS);

    // 查找现有用户
    const userRes = await usersColl
      .where({ _openid: OPENID })
      .limit(1)
      .get();

    // 用户已存在，更新最后登录时间并返回
    if (userRes.data.length > 0) {
      const user = userRes.data[0];
      const lastLoginTime = new Date();
      await usersColl.doc(user._id).update({
        data: { lastLoginTime },
      });
      console.log('[login] 老用户登录:', user.nickname || user._openid);
      return success({ ...user, lastLoginTime }, '登录成功');
    }

    // 新用户，自动注册
    const now = new Date();
    const newUser = {
      _openid: OPENID,
      nickname: '',
      avatar: '',
      role: 'student',
      createTime: now,
      lastLoginTime: now,
    };

    const addRes = await usersColl.add({ data: newUser });
    newUser._id = addRes._id;

    console.log('[login] 新用户注册:', OPENID);
    return success(newUser, '注册成功');

  } catch (err) {
    console.error('[login] 异常:', err);
    return fail('登录失败：' + err.message);
  }
};
