/**
 * adminSupporter 云函数 — 管理员管理赞助记录
 *
 * 支持：
 * - add:    新增赞助记录（name / amount / month）
 * - edit:   编辑赞助记录（name / amount / month）
 * - delete: 删除赞助记录
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS, success, fail, getCollection, requireAdmin,
} = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 返回当前月份字符串，如 "2026-08"
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

exports.main = async (event, context) => {
  // 权限校验：仅管理员
  const admin = await requireAdmin(event);
  if (!admin) {
    return fail('权限不足，仅管理员可操作', -403);
  }

  const { action } = event;

  if (!['add', 'edit', 'delete'].includes(action)) {
    return fail('无效的操作类型，支持：add / edit / delete');
  }

  try {
    const supportersColl = getCollection(COLLECTIONS.SUPPORTERS);

    if (action === 'add') {
      const { name = '', amount, month = '' } = event;

      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return fail('请填写赞助者昵称');
      }

      const numAmount = Number(amount);
      if (!Number.isFinite(numAmount) || numAmount <= 0) {
        return fail('请填写正确的赞助金额');
      }

      const finalMonth = String(month).trim() || currentMonth();

      const data = {
        name: trimmedName,
        amount: numAmount,
        month: finalMonth,
        createTime: new Date(),
      };

      const addRes = await supportersColl.add({ data });
      data._id = addRes._id;

      console.log('[adminSupporter] 新增赞助记录:', trimmedName, '¥' + numAmount, finalMonth);
      return success(data, '赞助记录已添加');
    }

    if (action === 'edit') {
      const { supporterId, name, amount, month } = event;
      if (!supporterId) {
        return fail('缺少赞助记录ID');
      }

      const supporterRes = await supportersColl.doc(supporterId).get();
      if (!supporterRes.data) {
        return fail('赞助记录不存在');
      }

      const updateData = {};

      if (name !== undefined && name !== null) {
        const trimmedName = String(name).trim();
        if (!trimmedName) {
          return fail('请填写赞助者昵称');
        }
        updateData.name = trimmedName;
      }

      if (amount !== undefined && amount !== null) {
        const numAmount = Number(amount);
        if (!Number.isFinite(numAmount) || numAmount <= 0) {
          return fail('请填写正确的赞助金额');
        }
        updateData.amount = numAmount;
      }

      if (month !== undefined && month !== null && String(month).trim()) {
        updateData.month = String(month).trim();
      }

      if (Object.keys(updateData).length === 0) {
        return fail('没有可更新的内容');
      }

      updateData.updateTime = new Date();
      await supportersColl.doc(supporterId).update({ data: updateData });
      console.log('[adminSupporter] 赞助记录已编辑:', supporterId, Object.keys(updateData));
      return success(null, '赞助记录已更新');
    }

    if (action === 'delete') {
      const { supporterId } = event;
      if (!supporterId) {
        return fail('缺少赞助记录ID');
      }
      await supportersColl.doc(supporterId).remove();
      console.log('[adminSupporter] 已删除赞助记录:', supporterId);
      return success(null, '已删除');
    }

  } catch (err) {
    console.error('[adminSupporter] 异常:', err);
    return fail('操作失败：' + err.message);
  }
};
