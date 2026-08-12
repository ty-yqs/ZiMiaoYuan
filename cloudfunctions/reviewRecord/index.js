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

// 审核结果通知模板ID
const SUBSCRIBE_TMPL_ID = 'ImPQfyZeWGBqwauOUmFfI7SiCXfiNgrgb_CDt7v7U-Q';

/**
 * 发送审核结果订阅消息
 */
async function sendReviewNotification(openid, result, submitTime, reason, page) {
  if (!openid) return;

  const timeStr = submitTime
    ? (() => {
        const d = new Date(submitTime.getTime() + 8 * 3600000);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
      })()
    : '';

  try {
    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: SUBSCRIBE_TMPL_ID,
      page: page || '',
      data: {
        phrase1: { value: result },
        date4: { value: timeStr },
        thing5: { value: reason || '无' },
      },
    });
    console.log('[reviewRecord] 通知已发送:', openid, result);
  } catch (err) {
    console.warn('[reviewRecord] 推送通知失败:', err.message);
  }
}

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

    // 获取提交者 openid（新记录有 userId，旧记录回退 _openid）
    const submitterOpenid = record.userId || record._openid;
    console.log('[reviewRecord] 提交者 openid:', submitterOpenid, 'record.userId:', record.userId, 'record._openid:', record._openid);

    if (action === 'approve') {
      // 通过：更新记录状态
      await getCollection(COLLECTIONS.RECORDS).doc(recordId).update({
        data: { status: 'approved' },
      });

      // 如果是照片记录，追加所有照片到猫咪的 photos 数组
      const recordPhotos = record.photos || (record.photo ? [record.photo] : []);
      if (record.type === 'photo' && recordPhotos.length > 0) {
        const _ = cloud.database().command;
        await getCollection(COLLECTIONS.CATS).doc(record.catId).update({
          data: { photos: _.push(recordPhotos) },
        });
      }

      console.log('[reviewRecord] 准备发送通过通知, openid:', submitterOpenid);
      await sendReviewNotification(submitterOpenid, '通过', record.createTime, '无', `/pages/index/index`);
      console.log('[reviewRecord] 记录已通过:', recordId);
      return success(null, '记录已通过审核');
    }

    if (action === 'reject') {
      // 拒绝：更新记录状态并存储驳回理由
      await getCollection(COLLECTIONS.RECORDS).doc(recordId).update({
        data: { status: 'rejected', rejectReason: reason.trim() },
      });

      console.log('[reviewRecord] 准备发送拒绝通知, openid:', submitterOpenid);
      await sendReviewNotification(submitterOpenid, '拒绝', record.createTime, reason || '未填写', `/pages/index/index`);
      console.log('[reviewRecord] 记录已拒绝:', recordId);
      return success(null, '记录已拒绝');
    }

  } catch (err) {
    console.error('[reviewRecord] 异常:', err);
    return fail('操作失败：' + err.message);
  }
};
