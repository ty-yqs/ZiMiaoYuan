/**
 * adminGetImages 云函数 — 批量把 cloud:// fileID 转成 https 临时链接
 *
 * 网页后台无法使用小程序端的 imageCache.js（依赖 wx 全局对象），
 * 需在服务端用 getTempFileURL 转换。仅管理员可调用。
 */
const cloud = require('wx-server-sdk');
const { success, fail, requireAdmin } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  // 权限校验
  const admin = await requireAdmin(event);
  if (!admin) {
    return fail('权限不足，仅管理员可操作', -403);
  }

  const { fileIds = [] } = event || {};
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    return fail('缺少 fileIds 参数');
  }

  // 过滤 cloud:// 前缀、去重，单次最多 50 个
  const ids = [...new Set(fileIds.filter(id => id && id.startsWith('cloud://')))].slice(0, 50);

  if (ids.length === 0) {
    return success([]);
  }

  try {
    const res = await cloud.getTempFileURL({ fileList: ids });
    const list = (res.fileList || []).map(f => ({
      fileId: f.fileID,
      tempFileURL: f.tempFileURL || '',
    }));
    return success(list);
  } catch (err) {
    console.error('[adminGetImages] 异常:', err);
    return fail('转换失败：' + err.message);
  }
};
