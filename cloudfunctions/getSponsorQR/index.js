/**
 * getSponsorQR 云函数 — 获取赞助二维码临时链接
 * 云函数有完整存储权限，不受前端 STORAGE_EXCEED_AUTHORITY 限制
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  try {
    const res = await cloud.getTempFileURL({
      fileList: ['cloud://cloud2-d1gbjipxm9c21dd8d.636c-cloud2-d1gbjipxm9c21dd8d-1464135428/sponsor/sponsor.jpg'],
    });
    if (res.fileList && res.fileList.length > 0 && res.fileList[0].tempFileURL) {
      return { code: 0, data: { url: res.fileList[0].tempFileURL } };
    }
    return { code: -1, message: '获取二维码失败' };
  } catch (err) {
    return { code: -1, message: err.message };
  }
};
