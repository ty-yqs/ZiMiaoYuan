/**
 * manageSettings 云函数 — 管理员管理全局功能开关
 *
 * 设置项：
 * - feedOpen    是否开放浏览动态页面
 * - recordsOpen 是否开放浏览用户发现记录
 * - notesOpen   是否开放浏览便利贴
 *
 * 支持：
 * - get:    获取当前设置（缺失时返回默认值，默认全部开放）
 * - update: 更新设置（传入哪些字段就更新哪些字段）
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS, success, fail, getCollection, getDB, requireAdmin,
} = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const ACTIONS = ['get', 'update'];
const SETTINGS_ID = 'global';
const DEFAULT_SETTINGS = { feedOpen: true, recordsOpen: true, notesOpen: true };

/** 确保 settings 集合存在（首次保存时自动创建，已存在则忽略） */
async function ensureCollection() {
  try {
    if (typeof getDB().createCollection === 'function') {
      await getDB().createCollection(COLLECTIONS.SETTINGS);
    }
  } catch (e) {
    // 集合已存在或创建失败，忽略
  }
}

/** 读取当前设置，缺失时返回默认值 */
async function readSettings() {
  try {
    const res = await getCollection(COLLECTIONS.SETTINGS).doc(SETTINGS_ID).get();
    if (res && res.data) {
      return {
        feedOpen: res.data.feedOpen !== false,
        recordsOpen: res.data.recordsOpen !== false,
        notesOpen: res.data.notesOpen !== false,
      };
    }
  } catch (e) {
    // 文档不存在或读取失败时走默认值
  }
  return { ...DEFAULT_SETTINGS };
}

exports.main = async (event) => {
  const admin = await requireAdmin(event);
  if (!admin) {
    return fail('权限不足，仅管理员可操作', -403);
  }

  const { action } = event;

  if (!ACTIONS.includes(action)) {
    return fail('无效的操作类型，支持：' + ACTIONS.join(' / '));
  }

  try {
    if (action === 'get') {
      return success(await readSettings());
    }

    if (action === 'update') {
      const current = await readSettings();
      const updates = {};

      if (event.feedOpen !== undefined && event.feedOpen !== null) {
        updates.feedOpen = event.feedOpen !== false;
      }
      if (event.recordsOpen !== undefined && event.recordsOpen !== null) {
        updates.recordsOpen = event.recordsOpen !== false;
      }
      if (event.notesOpen !== undefined && event.notesOpen !== null) {
        updates.notesOpen = event.notesOpen !== false;
      }

      if (Object.keys(updates).length === 0) {
        return fail('没有可更新的内容');
      }

      const merged = { ...current, ...updates, updateTime: new Date() };
      await ensureCollection();
      await getCollection(COLLECTIONS.SETTINGS).doc(SETTINGS_ID).set({ data: merged });
      console.log('[manageSettings] 设置已更新:', Object.keys(updates).join(', '));
      return success(merged, '设置已保存');
    }

    return fail('无效的操作类型');
  } catch (err) {
    console.error('[manageSettings] 异常:', err);
    return fail('操作失败：' + err.message);
  }
};
