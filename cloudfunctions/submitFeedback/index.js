/**
 * submitFeedback 云函数 — 提交用户反馈与建议
 */
const cloud = require('wx-server-sdk');
const { success, fail, getCollection } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return fail('请先登录');
  }

  const { content = '', contact = '' } = event;

  if (!content.trim()) {
    return fail('请输入反馈内容');
  }

  try {
    const now = new Date();

    await getCollection('feedbacks').add({
      data: {
        _openid: OPENID,
        content: content.trim(),
        contact: contact.trim(),
        createTime: now,
      },
    });

    return success(null, '感谢你的反馈！');

  } catch (err) {
    console.error('[submitFeedback] 异常:', err);
    return fail('提交失败：' + err.message);
  }
};
