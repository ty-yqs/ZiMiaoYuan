/**
 * uploadRecord 云函数 — 为已有猫咪上传发现记录
 *
 * 支持多张照片合为一条记录提交
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
    photos = [],
    description = '',
    location = {},
  } = event;

  // 兼容：photos 数组优先，否则用单张 photo
  const photoList = photos.length > 0 ? photos : (photo ? [photo] : []);
  const isNote = photoList.length === 0;

  if (!catId) {
    return fail('缺少猫咪ID');
  }
  if (!isNote && photoList.length === 0 && !description) {
    return fail('请上传照片或填写内容');
  }

  try {
    // 确认猫咪存在
    const catRes = await getCollection(COLLECTIONS.CATS).doc(catId).get();
    if (!catRes.data) {
      return fail('猫咪不存在');
    }

    // 查询用户昵称和头像
    let nickname = '匿名猫友';
    let userAvatar = '';
    try {
      const userRes = await getCollection(COLLECTIONS.USERS)
        .where({ _openid: OPENID })
        .limit(1)
        .get();
      if (userRes.data && userRes.data.length > 0) {
        nickname = userRes.data[0].nickname || nickname;
        userAvatar = userRes.data[0].avatar || '';
      }
    } catch (e) {
      // 查不到用户就用默认昵称
    }

    const now = new Date();

    // 创建一条记录，photos 字段存所有照片
    const recordData = {
      catId,
      userId: OPENID,
      nickname,
      userAvatar,
      type: isNote ? 'note' : 'photo',
      status: 'pending',
      photos: photoList,
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

    // 更新猫咪 updateTime
    await getCollection(COLLECTIONS.CATS).doc(catId).update({
      data: { updateTime: now },
    });

    console.log('[uploadRecord] 记录已创建:', recordRes._id, '照片数:', photoList.length);

    return success(recordData, '提交成功，等待管理员审核');

  } catch (err) {
    console.error('[uploadRecord] 异常:', err);
    return fail('提交失败：' + err.message);
  }
};
