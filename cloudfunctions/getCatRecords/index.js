/**
 * getCatRecords 云函数 — 分页获取猫咪的发现记录
 *
 * @param {string} catId    - 猫咪 _id
 * @param {number} page     - 页码，默认 1
 * @param {number} pageSize - 每页数量，默认 10
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const { catId, page = 1, pageSize = 10 } = event;

  if (!catId) {
    return { code: -1, message: '缺少猫咪ID', data: null };
  }

  try {
    const _ = db.command;

    // 分页查询已审核的记录
    const skip = (page - 1) * pageSize;
    const countRes = await db.collection('records')
      .where({ catId, status: 'approved' })
      .count();
    const total = countRes.total;

    const recordsRes = await db.collection('records')
      .where({ catId, status: 'approved' })
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

    // 为没有 userAvatar 的旧记录回填头像
    const needAvatar = records.filter(r => !r.userAvatar && r.userId);
    if (needAvatar.length > 0) {
      const openids = [...new Set(needAvatar.map(r => r.userId))];
      try {
        const usersRes = await db.collection('users')
          .where({ _openid: _.in(openids) })
          .field({ _openid: true, avatar: true })
          .get();

        const avatarMap = {};
        usersRes.data.forEach(u => { avatarMap[u._openid] = u.avatar || ''; });

        for (const r of records) {
          if (!r.userAvatar && avatarMap[r.userId]) {
            r.userAvatar = avatarMap[r.userId];
            // 异步回写（不阻塞返回）
            db.collection('records').doc(r._id).update({
              data: { userAvatar: r.userAvatar },
            }).catch(e => console.warn('[getCatRecords] 回写头像失败:', e.message));
          }
        }
      } catch (e) {
        console.warn('[getCatRecords] 批量查询头像失败:', e.message);
      }
    }

    return {
      code: 0,
      message: 'ok',
      data: { records, total, hasMore: skip + pageSize < total },
    };
  } catch (err) {
    console.error('[getCatRecords] 异常:', err);
    return { code: -1, message: '查询失败：' + err.message, data: null };
  }
};
