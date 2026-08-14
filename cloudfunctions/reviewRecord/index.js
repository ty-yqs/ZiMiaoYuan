/**
 * reviewRecord 云函数 — 管理员操作记录（新照片 / 便利贴）
 *
 * 支持：
 * - approve: 审核通过（照片记录会把照片追加到猫咪图库）
 * - reject:  审核拒绝（清理该记录上传的图片）
 * - edit:    编辑记录（描述 / 照片，自动清理被移除的图片并同步猫咪图库）
 * - delete:  删除记录（清理图片并同步猫咪图库）
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS, success, fail, getCollection, requireAdmin, deleteCloudFiles,
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

/**
 * 同步猫咪图库（读-改-写）
 * 把猫咪 photos 数组里属于旧记录照片的部分移除，再追加新照片。
 *
 * @param {string} catId
 * @param {string[]} oldPhotos - 记录编辑/删除前的照片
 * @param {string[]} newPhotos - 记录编辑后的照片（删除时传空数组）
 */
async function syncCatPhotos(catId, oldPhotos, newPhotos) {
  if (!catId || (oldPhotos.length === 0 && newPhotos.length === 0)) return;

  try {
    const catRes = await getCollection(COLLECTIONS.CATS).doc(catId).get();
    if (!catRes.data) return;

    const oldSet = new Set(oldPhotos);
    const current = catRes.data.photos || [];
    const merged = current.filter(p => !oldSet.has(p)).concat(newPhotos);

    await getCollection(COLLECTIONS.CATS).doc(catId).update({
      data: { photos: merged, updateTime: new Date() },
    });
  } catch (err) {
    console.warn('[reviewRecord] 同步猫咪图库失败:', catId, err.message);
  }
}

exports.main = async (event, context) => {
  // 权限校验：仅管理员
  const admin = await requireAdmin(event);
  if (!admin) {
    return fail('权限不足，仅管理员可操作', -403);
  }

  const { recordId, action, reason = '', description, photos } = event;

  if (!recordId || !['approve', 'reject', 'edit', 'delete'].includes(action)) {
    return fail('参数错误');
  }

  try {
    // 查找记录
    const recordRes = await getCollection(COLLECTIONS.RECORDS).doc(recordId).get();
    if (!recordRes.data) {
      return fail('记录不存在');
    }

    const record = recordRes.data;
    const recordPhotos = record.photos || (record.photo ? [record.photo] : []);

    // 审核通过/拒绝仅对 pending 生效；编辑/删除不受状态限制
    if ((action === 'approve' || action === 'reject') && record.status !== 'pending') {
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

      // 拒绝后清理该记录上传的图片（photos + 旧记录的单张 photo，自动去重）
      const fileIds = [...(record.photos || []), record.photo].filter(Boolean);
      const delRes = await deleteCloudFiles(fileIds);
      console.log('[reviewRecord] 已清理拒绝记录图片:', recordId, '删除', delRes.deleted, '失败', delRes.failed);

      console.log('[reviewRecord] 准备发送拒绝通知, openid:', submitterOpenid);
      await sendReviewNotification(submitterOpenid, '拒绝', record.createTime, reason || '未填写', `/pages/index/index`);
      console.log('[reviewRecord] 记录已拒绝:', recordId);
      return success(null, '记录已拒绝');
    }

    if (action === 'edit') {
      const updateData = {};

      // 描述
      if (description !== undefined && description !== null) {
        updateData.description = String(description);
      }

      // 照片：photos 传数组表示「覆盖为新照片列表」
      if (Array.isArray(photos)) {
        const newPhotos = photos.filter(p => p && typeof p === 'string');
        const removed = recordPhotos.filter(p => !newPhotos.includes(p));
        const added = newPhotos.filter(p => !recordPhotos.includes(p));

        updateData.photos = newPhotos;
        // 类型跟随照片有无变化
        updateData.type = newPhotos.length > 0 ? 'photo' : 'note';

        // 清理被移除的图片
        if (removed.length > 0) {
          await deleteCloudFiles(removed);
        }

        // 已通过的记录同步猫咪图库
        if (record.status === 'approved') {
          await syncCatPhotos(record.catId, recordPhotos, newPhotos);
        }
      }

      if (Object.keys(updateData).length === 0) {
        return fail('没有可更新的内容');
      }

      updateData.updateTime = new Date();
      await getCollection(COLLECTIONS.RECORDS).doc(recordId).update({ data: updateData });
      console.log('[reviewRecord] 记录已编辑:', recordId);
      return success(null, '记录已更新');
    }

    if (action === 'delete') {
      // 删除记录
      await getCollection(COLLECTIONS.RECORDS).doc(recordId).remove();

      // 清理该记录上传的图片
      await deleteCloudFiles(recordPhotos);

      // 已通过的记录同步猫咪图库（移除这些照片）
      if (record.status === 'approved') {
        await syncCatPhotos(record.catId, recordPhotos, []);
      }

      console.log('[reviewRecord] 记录已删除:', recordId);
      return success(null, '记录已删除');
    }

  } catch (err) {
    console.error('[reviewRecord] 异常:', err);
    return fail('操作失败：' + err.message);
  }
};
