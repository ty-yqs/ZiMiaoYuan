/**
 * reviewRecord 云函数 — 管理员审核记录（新照片 / 便利贴）
 *
 * 审核通过时：
 *   - 更新 record 状态为 approved
 *   - 如果是照片类记录，将 photo 追加到猫咪的 photos 数组
 *
 * 审核拒绝时：
 *   - 更新 record 状态为 rejected
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

  const { recordId, action, reason = '' } = event; // action: 'approve' | 'reject'

  if (!recordId || !['approve', 'reject'].includes(action)) {
    return fail('参数错误');
  }

  try {
    // 查找记录
    const recordRes = await getCollection(COLLECTIONS.RECORDS).doc(recordId).get();
    if (!recordRes.data) {
      return fail('记录不存在');
    }

    const record = recordRes.data;

    if (record.status !== 'pending') {
      return fail('该记录已处理');
    }

    if (action === 'approve') {
      // 通过：更新记录状态
      await getCollection(COLLECTIONS.RECORDS).doc(recordId).update({
        data: { status: 'approved' },
      });

      // 如果是照片记录，追加照片到猫咪的 photos 数组
      if (record.type === 'photo' && record.photo) {
        const _ = cloud.database().command;
        await getCollection(COLLECTIONS.CATS).doc(record.catId).update({
          data: { photos: _.push([record.photo]) },
        });
      }

      console.log('[reviewRecord] 记录已通过:', recordId);
      return success(null, '记录已通过审核');
    }

    if (action === 'reject') {
      // 拒绝：更新记录状态并存储驳回理由
      await getCollection(COLLECTIONS.RECORDS).doc(recordId).update({
        data: { status: 'rejected', rejectReason: reason.trim() },
      });

      console.log('[reviewRecord] 记录已拒绝:', recordId);
      return success(null, '记录已拒绝');
    }

  } catch (err) {
    console.error('[reviewRecord] 异常:', err);
    return fail('操作失败：' + err.message);
  }
};
