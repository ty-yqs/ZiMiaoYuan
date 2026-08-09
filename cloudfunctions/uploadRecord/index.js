/**
 * uploadRecord 云函数 — 为已有猫咪上传发现记录
 *
 * 记录提交后状态为 pending，需管理员审核通过后方可公开显示
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, success, fail, getCollection } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return fail('请先登录');
  }

  const {
    catId,
    photo = '',
    description = '',
    location = {},
  } = event;

  // 校验
  if (!catId) {
    return fail('缺少猫咪ID');
  }
  if (!photo && !description) {
    return fail('请上传照片或填写内容');
  }

  try {
    // 先确认猫咪存在
    const catRes = await getCollection(COLLECTIONS.CATS).doc(catId).get();
    if (!catRes.data) {
      return fail('猫咪不存在');
    }

    // 查询用户昵称
    let nickname = '匿名猫友';
    try {
      const userRes = await getCollection(COLLECTIONS.USERS)
        .where({ _openid: OPENID })
        .limit(1)
        .get();
      if (userRes.data && userRes.data.length > 0 && userRes.data[0].nickname) {
        nickname = userRes.data[0].nickname;
      }
    } catch (e) {
      // 查不到用户就用默认昵称
    }

    const now = new Date();
    const isNote = !photo; // 无照片即为便利贴

    // 创建发现记录（待审核）
    const recordData = {
      catId,
      userId: OPENID,
      nickname,
      type: isNote ? 'note' : 'photo',
      status: 'pending',     // 需管理员审核
      photo,
      location: {
        name: location.name || '',
        latitude: location.latitude || 0,
        longitude: location.longitude || 0,
      },
      description: description || '',
      createTime: now,
    };

    const recordRes = await getCollection(COLLECTIONS.RECORDS).add({ data: recordData });
    recordData._id = recordRes._id;

    // 仅更新猫咪档案的 updateTime（照片等审核通过后再追加）
    await getCollection(COLLECTIONS.CATS).doc(catId).update({
      data: { updateTime: now },
    });

    console.log('[uploadRecord] 待审核记录已创建:', recordRes._id);

    return success(recordData, '提交成功，等待管理员审核');

  } catch (err) {
    console.error('[uploadRecord] 异常:', err);
    return fail('提交失败：' + err.message);
  }
};
