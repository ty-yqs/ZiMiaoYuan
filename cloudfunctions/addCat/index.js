/**
 * addCat 云函数 — 新增猫咪档案 + 首条发现记录
 *
 * 流程：
 * 1. 校验必填字段
 * 2. 创建猫咪档案（status: pending，需管理员审核）
 * 3. 同时创建一条发现记录
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, CAT_STATUS, success, fail, getCollection } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return fail('请先登录');
  }

  const {
    cat_name = '',
    photos = [],
    avatar = '',
    gender = 'unknown',
    color = '',
    description = '',
    location = {},
    age = 'unknown',
    health = { sterilized: false, vaccinated: false },
  } = event;

  // 校验
  if (!color) {
    return fail('请选择猫咪毛色');
  }
  if (!photos || photos.length === 0) {
    return fail('请至少上传一张照片');
  }

  try {
    const now = new Date();

    // Step 1: 创建猫咪档案
    const catData = {
      cat_name: cat_name || '未命名猫咪',
      photos,
      avatar: avatar || photos[0], // 默认用第一张做头像
      gender,
      age,
      color,
      description: description || '',
      location: {
        name: location.name || '',
        latitude: location.latitude || 0,
        longitude: location.longitude || 0,
      },
      health: {
        sterilized: health.sterilized || false,
        vaccinated: health.vaccinated || false,
      },
      status: CAT_STATUS.PENDING, // 新猫咪默认待审核
      _openid: OPENID,           // 云函数需手动设置文档所有者
      creator: OPENID,
      createTime: now,
      updateTime: now,
    };

    const catRes = await getCollection(COLLECTIONS.CATS).add({ data: catData });
    const catId = catRes._id;

    console.log('[addCat] 猫咪档案已创建:', catId, '名称:', cat_name);

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

    // Step 2: 创建首条发现记录
    const recordData = {
      catId,
      userId: OPENID,
      nickname,
      photo: photos[0],
      location: catData.location,
      description: description || '首次发现',
      createTime: now,
    };

    await getCollection(COLLECTIONS.RECORDS).add({ data: recordData });

    console.log('[addCat] 首条记录已创建');

    // 返回完整的猫咪数据
    catData._id = catId;
    return success(catData, '提交成功，等待管理员审核');

  } catch (err) {
    console.error('[addCat] 异常:', err);
    return fail('提交失败：' + err.message);
  }
};
