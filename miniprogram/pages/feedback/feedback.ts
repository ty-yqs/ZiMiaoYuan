/**
 * 反馈与建议页
 */
import { apiSubmitFeedback } from '../../utils/api';
import { showToast, showLoading, hideLoading, requireProfile } from '../../utils/util';

Page({
  data: {
    content: '',
    contact: '',
    submitting: false,
  },

  onLoad() {
    wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] });
  },

  onShow() {
    requireProfile();
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ content: e.detail.value });
  },

  onContactInput(e: WechatMiniprogram.Input) {
    this.setData({ contact: e.detail.value });
  },

  onShareAppMessage() {
    return { title: '反馈与建议', path: '/pages/feedback/feedback' };
  },

  async onSubmit() {
    const content = this.data.content.trim();
    if (!content) {
      showToast('请输入反馈内容', 'error');
      return;
    }
    if (this.data.submitting) return;

    this.setData({ submitting: true });
    showLoading('提交中...');

    const res = await apiSubmitFeedback({
      content,
      contact: this.data.contact.trim(),
    });

    hideLoading();

    if (res.code === 0) {
      showToast('感谢你的反馈！', 'success');
      setTimeout(() => wx.navigateBack(), 1500);
    } else {
      showToast(res.message || '提交失败', 'error');
      this.setData({ submitting: false });
    }
  },
});
