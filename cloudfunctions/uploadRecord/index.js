/**
 * uploadRecord 云函数 — 为已有猫咪上传发现记录
 *
 * 同时更新猫咪档案的 updateTime
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

    // Step 1: 创建发现记录
    const recordData = {
      catId,
      userId: OPENID,
      nickname,
      type: isNote ? 'note' : 'photo',
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

    // Step 2: 更新猫咪档案的 updateTime，有照片则追加到 photos 数组
    const _ = cloud.database().command;
    const updateData = { updateTime: now };
    if (photo) {
      updateData.photos = _.push([photo]);
    }
    await getCollection(COLLECTIONS.CATS).doc(catId).update({
      data: updateData,
    });

    console.log('[uploadRecord] 记录已创建:', recordRes._id);

    return success(recordData, '记录成功');

  } catch (err) {
    console.error('[uploadRecord] 异常:', err);
    return fail('提交失败：' + err.message);
  }
};
