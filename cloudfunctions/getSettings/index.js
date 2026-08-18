/**
 * getSettings 云函数 — 获取全局功能开关（公开读）
 *
 * 返回针对当前调用者生效的开关：
 * - 对已设置昵称头像的用户：返回全局开关原值
 * - 对未设置昵称头像的游客：仅在 guestBrowseOpen 开放时才可见
 *
 * 返回 { feedOpen, recordsOpen, notesOpen }（均为生效值）。
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, success, getCollection, isGuestUser } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const DEFAULTS = { feedOpen: true, recordsOpen: true, notesOpen: true, guestBrowseOpen: true };

async function readSettings() {
  try {
    const res = await getCollection(COLLECTIONS.SETTINGS).doc('global').get();
    if (res && res.data) {
      return {
        feedOpen: res.data.feedOpen !== false,
        recordsOpen: res.data.recordsOpen !== false,
        notesOpen: res.data.notesOpen !== false,
        guestBrowseOpen: res.data.guestBrowseOpen !== false,
      };
    }
  } catch (e) {
    // 集合/文档不存在或读取失败时走默认值
  }
  return { ...DEFAULTS };
}

exports.main = async () => {
  try {
    const raw = await readSettings();
    const { OPENID } = cloud.getWXContext();
    const isGuest = await isGuestUser(OPENID);
    const guestAllowed = !isGuest || raw.guestBrowseOpen;

    return success({
      feedOpen: raw.feedOpen && guestAllowed,
      recordsOpen: raw.recordsOpen && guestAllowed,
      notesOpen: raw.notesOpen && guestAllowed,
    });
  } catch (err) {
    return success({ feedOpen: true, recordsOpen: true, notesOpen: true });
  }
};
