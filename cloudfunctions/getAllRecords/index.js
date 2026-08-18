/**
 * getAllRecords 云函数 — 分页获取所有猫咪的已审核发现记录（动态流）
 *
 * @param {number} page     - 页码，默认 1
 * @param {number} pageSize - 每页数量，默认 10
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS, success, fail, getCollection, getAppSettings,
} = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { page = 1, pageSize = 10 } = event;

  try {
    // 动态页未开放时直接返回空列表
    const settings = await getAppSettings();
    if (settings.feedOpen === false) {
      return success({ records: [], total: 0, hasMore: false, disabled: true });
    }

    const _ = cloud.database().command;
    const skip = (page - 1) * pageSize;

    const countRes = await getCollection(COLLECTIONS.RECORDS)
      .where({ status: 'approved' })
      .count();
    const total = countRes.total;

    const recordsRes = await getCollection(COLLECTIONS.RECORDS)
      .where({ status: 'approved' })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    const records = recordsRes.data;

    // 兼容旧记录：把单张 photo 转为 photos 数组
    for (const r of records) {
      if (!r.photos || r.photos.length === 0) {
        r.photos = r.photo ? [r.photo] : [];
      }
    }

    // 为没有 userAvatar 的旧记录回填发表者头像
    const needAvatar = records.filter(r => !r.userAvatar && r.userId);
    if (needAvatar.length > 0) {
      const openids = [...new Set(needAvatar.map(r => r.userId))];
      try {
        const usersRes = await getCollection(COLLECTIONS.USERS)
          .where({ _openid: _.in(openids) })
          .field({ _openid: true, avatar: true })
          .get();

        const avatarMap = {};
        usersRes.data.forEach(u => { avatarMap[u._openid] = u.avatar || ''; });

        for (const r of records) {
          if (!r.userAvatar && avatarMap[r.userId]) {
            r.userAvatar = avatarMap[r.userId];
            // 异步回写（不阻塞返回）
            getCollection(COLLECTIONS.RECORDS).doc(r._id).update({
              data: { userAvatar: r.userAvatar },
            }).catch(e => console.warn('[getAllRecords] 回写头像失败:', e.message));
          }
        }
      } catch (e) {
        console.warn('[getAllRecords] 批量查询头像失败:', e.message);
      }
    }

    // join 猫咪卡片信息
    const catIds = [...new Set(records.map(r => r.catId).filter(Boolean))];
    const catMap = {};
    if (catIds.length > 0) {
      try {
        const catsRes = await getCollection(COLLECTIONS.CATS)
          .where({ _id: _.in(catIds) })
          .field({
            cat_name: true,
            avatar: true,
            color: true,
            gender: true,
            age: true,
            adopted: true,
            passedAway: true,
            missing: true,
          })
          .get();

        catsRes.data.forEach(c => { catMap[c._id] = c; });
      } catch (e) {
        console.warn('[getAllRecords] 批量查询猫咪失败:', e.message);
      }
    }

    const list = records.map(r => ({
      ...r,
      cat: catMap[r.catId] || null,
    }));

    return success({
      records: list,
      total,
      hasMore: skip + pageSize < total,
    });
  } catch (err) {
    console.error('[getAllRecords] 异常:', err);
    return fail('查询失败：' + err.message);
  }
};
