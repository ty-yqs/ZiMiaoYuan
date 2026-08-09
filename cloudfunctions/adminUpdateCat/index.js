/**
 * adminUpdateCat 云函数 — 管理员操作
 *
 * 支持：
 * - approve: 审核通过
 * - reject:  审核拒绝
 * - update:  修改猫咪信息
 * - delete:  删除猫咪及其关联记录
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS, CAT_STATUS, ROLES,
  success, fail, getCollection, getDB, getUserByOpenid,
} = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 审核结果通知模板ID
const SUBSCRIBE_TMPL_ID = 'ImPQfyZeWGBqwauOUmFfI7SiCXfiNgrgb_CDt7v7U-Q';

/**
 * 发送审核结果订阅消息
 * @param {string} openid - 接收者 openid
 * @param {string} result - 审核结果：'通过' | '拒绝'
 * @param {Date} submitTime - 提交时间
 * @param {string} reason - 拒绝理由（通过时传 '无'）
 * @param {string} page - 跳转页面路径（可选）
 */
async function sendReviewNotification(openid, result, submitTime, reason, page = '') {
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
    console.log('[adminUpdateCat] 通知已发送:', openid, result);
  } catch (err) {
    // 推送失败不影响审核本身（用户可能未订阅）
    console.warn('[adminUpdateCat] 推送通知失败:', err.message);
  }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  // ==================== 权限校验 ====================
  const user = await getUserByOpenid(OPENID);
  if (!user || user.role !== ROLES.ADMIN) {
    return fail('权限不足，仅管理员可操作', -403);
  }

  const { catId, action, updates = {} } = event;

  if (!['approve', 'reject', 'update', 'delete', 'reviewEdit', 'toggleAdopted', 'togglePassedAway', 'toggleMissing'].includes(action)) {
    return fail('无效的操作类型，支持：approve / reject / update / delete / reviewEdit / toggleAdopted / togglePassedAway / toggleMissing');
  }

  // reviewEdit 不需要 catId（使用 proposalId）
  if (action !== 'reviewEdit' && !catId) {
    return fail('缺少猫咪ID');
  }

  try {
    const catsColl = getCollection(COLLECTIONS.CATS);
    const now = new Date();

    // reviewEdit 不需要预先确认猫咪存在（在 case 内处理）
    let catData = null;
    if (action !== 'reviewEdit') {
      const catRes = await catsColl.doc(catId).get();
      if (!catRes.data) {
        return fail('猫咪不存在');
      }
      catData = catRes.data;
    }

    switch (action) {

      // ========== 审核通过 ==========
      case 'approve':
        await catsColl.doc(catId).update({
          data: {
            status: CAT_STATUS.APPROVED,
            updateTime: now,
          },
        });
        const submitterOpenid = catData.creator || catData._openid;
        console.log('[adminUpdateCat] 准备发送通过通知, openid:', submitterOpenid, 'creator:', catData.creator, '_openid:', catData._openid);
        await sendReviewNotification(submitterOpenid, '通过', catData.createTime, '无', `/pages/index/index`);
        console.log('[adminUpdateCat] 审核通过:', catId);
        return success(null, '已审核通过');

      // ========== 审核拒绝 ==========
      case 'reject': {
        const { reason = '' } = event;
        await catsColl.doc(catId).update({
          data: {
            status: CAT_STATUS.REJECTED,
            rejectReason: reason.trim(),
            updateTime: now,
          },
        });
        const rejectOpenid = catData.creator || catData._openid;
        console.log('[adminUpdateCat] 准备发送拒绝通知, openid:', rejectOpenid, 'creator:', catData.creator, '_openid:', catData._openid);
        await sendReviewNotification(rejectOpenid, '拒绝', catData.createTime, reason || '未填写', `/pages/index/index`);
        console.log('[adminUpdateCat] 审核拒绝:', catId, reason ? '原因:' + reason : '');
        return success(null, '已拒绝');
      }

      // ========== 修改信息 ==========
      case 'update': {
        const allowedUpdates = {};
        const updatableFields = [
          'cat_name', 'color', 'gender', 'age', 'description',
          'location', 'health', 'photos', 'avatar',
        ];

        for (const field of updatableFields) {
          if (updates[field] !== undefined) {
            allowedUpdates[field] = updates[field];
          }
        }

        if (Object.keys(allowedUpdates).length === 0) {
          return fail('没有可更新的字段');
        }

        allowedUpdates.updateTime = now;

        await catsColl.doc(catId).update({ data: allowedUpdates });
        console.log('[adminUpdateCat] 信息已修改:', catId, Object.keys(allowedUpdates));
        return success(null, '信息已更新');
      }

      // ========== 删除猫咪 ==========
      case 'delete': {
        // 删除关联的发现记录
        const recordsRes = await getCollection(COLLECTIONS.RECORDS)
          .where({ catId })
          .get();

        if (recordsRes.data.length > 0) {
          // 云数据库批量删除需要逐个进行（或通过云端事务）
          const deletePromises = recordsRes.data.map(r =>
            getCollection(COLLECTIONS.RECORDS).doc(r._id).remove()
          );
          await Promise.all(deletePromises);
          console.log('[adminUpdateCat] 已删除关联记录:', recordsRes.data.length, '条');
        }

        // 删除关联的关系记录
        const _ = getDB().command;
        const relRes = await getCollection(COLLECTIONS.RELATIONSHIPS)
          .where(_.or([{ catId1: catId }, { catId2: catId }]))
          .get();

        if (relRes.data.length > 0) {
          const deleteRelPromises = relRes.data.map(r =>
            getCollection(COLLECTIONS.RELATIONSHIPS).doc(r._id).remove()
          );
          await Promise.all(deleteRelPromises);
          console.log('[adminUpdateCat] 已删除关联关系:', relRes.data.length, '条');
        }

        // 删除猫咪档案
        await catsColl.doc(catId).remove();
        console.log('[adminUpdateCat] 猫咪已删除:', catId);
        return success(null, '已删除');
      }

      // ========== 审核编辑提案 ==========
      case 'reviewEdit': {
        const { proposalId, decision, adminNote = '' } = event;

        if (!proposalId) {
          return fail('缺少提案ID');
        }
        if (!['approve', 'reject'].includes(decision)) {
          return fail('decision 必须为 approve 或 reject');
        }

        const proposalsColl = getCollection(COLLECTIONS.EDIT_PROPOSALS);

        // 读取提案
        const proposalRes = await proposalsColl.doc(proposalId).get();
        if (!proposalRes.data) {
          return fail('编辑提案不存在');
        }

        const proposal = proposalRes.data;
        if (proposal.status !== 'pending') {
          return fail('该提案已被处理');
        }

        if (decision === 'approve') {
          // 应用修改到猫咪档案
          await catsColl.doc(proposal.catId).update({
            data: {
              ...proposal.proposedChanges,
              updateTime: now,
            },
          });

          // 应用关系变更
          const relChanges = proposal.proposedRelationshipChanges;
          if (relChanges) {
            const relationshipsColl = getCollection(COLLECTIONS.RELATIONSHIPS);
            const catId = proposal.catId;

            // 添加新关系
            if (relChanges.add && relChanges.add.length > 0) {
              for (const add of relChanges.add) {
                let relCatId1, relCatId2;
                if (add.type === 'parent_child') {
                  relCatId1 = add.parentIsCurrent ? catId : add.otherCatId;
                  relCatId2 = add.parentIsCurrent ? add.otherCatId : catId;
                } else {
                  relCatId1 = catId < add.otherCatId ? catId : add.otherCatId;
                  relCatId2 = catId < add.otherCatId ? add.otherCatId : catId;
                }

                // 检查已存在
                const existRes = await relationshipsColl
                  .where({ catId1: relCatId1, catId2: relCatId2, type: add.type })
                  .limit(1)
                  .get();

                if (existRes.data.length === 0) {
                  await relationshipsColl.add({
                    data: {
                      catId1: relCatId1,
                      catId2: relCatId2,
                      type: add.type,
                      description: add.description || '',
                      createTime: now,
                      updateTime: now,
                    },
                  });
                  console.log('[adminUpdateCat] 已添加关系:', relCatId1, '<=>', relCatId2, add.type);
                }
              }
            }

            // 删除关系
            if (relChanges.remove && relChanges.remove.length > 0) {
              for (const item of relChanges.remove) {
                const relId = typeof item === 'string' ? item : item.relationshipId;
                try {
                  await relationshipsColl.doc(relId).remove();
                  console.log('[adminUpdateCat] 已删除关系:', relId);
                } catch (e) {
                  console.warn('[adminUpdateCat] 删除关系失败（可能已不存在）:', relId, e.message);
                }
              }
            }
          }

          const editOpenid = proposal.userId || proposal._openid;
          console.log('[adminUpdateCat] 准备发送编辑通过通知, openid:', editOpenid);
          await sendReviewNotification(editOpenid, '通过', proposal.createTime, '无', `/pages/index/index`);
        }

        // 更新提案状态
        const updateData = {
          status: decision === 'approve' ? 'approved' : 'rejected',
          updateTime: now,
        };
        if (decision === 'reject') {
          updateData.rejectReason = (event.reason || adminNote || '').trim();
        } else {
          updateData.adminNote = adminNote || '';
        }
        await proposalsColl.doc(proposalId).update({ data: updateData });

        // 发送审核通知（编辑拒绝时）
        if (decision === 'reject') {
          const editRejectOpenid = proposal.userId || proposal._openid;
          const rejectReason = updateData.rejectReason || '';
          console.log('[adminUpdateCat] 准备发送编辑拒绝通知, openid:', editRejectOpenid);
          await sendReviewNotification(editRejectOpenid, '拒绝', proposal.createTime, rejectReason || '未填写', `/pages/index/index`);
        }

        return success(null, decision === 'approve' ? '编辑已通过' : '编辑已拒绝');
      }

      // ========== 切换领养状态 ==========
      case 'toggleAdopted': {
        const cat = await catsColl.doc(catId).get();
        const newAdopted = !cat.data.adopted;
        await catsColl.doc(catId).update({
          data: { adopted: newAdopted, updateTime: now },
        });
        console.log('[adminUpdateCat] 领养状态已切换:', catId, newAdopted);
        return success({ adopted: newAdopted }, newAdopted ? '已标记为已领养' : '已取消领养标记');
      }

      // ========== 切换去喵星状态 ==========
      case 'togglePassedAway': {
        const cat = await catsColl.doc(catId).get();
        const newPassedAway = !cat.data.passedAway;
        await catsColl.doc(catId).update({
          data: { passedAway: newPassedAway, updateTime: now },
        });
        console.log('[adminUpdateCat] 去喵星状态已切换:', catId, newPassedAway);
        return success({ passedAway: newPassedAway }, newPassedAway ? '已标记为去喵星' : '已取消去喵星标记');
      }

      // ========== 切换失踪状态 ==========
      case 'toggleMissing': {
        const cat = await catsColl.doc(catId).get();
        const newMissing = !cat.data.missing;
        await catsColl.doc(catId).update({
          data: { missing: newMissing, updateTime: now },
        });
        console.log('[adminUpdateCat] 失踪状态已切换:', catId, newMissing);
        return success({ missing: newMissing }, newMissing ? '已标记为失踪' : '已取消失踪标记');
      }

      default:
        return fail('未知操作');
    }

  } catch (err) {
    console.error('[adminUpdateCat] 异常:', err);
    return fail('操作失败：' + err.message);
  }
};
