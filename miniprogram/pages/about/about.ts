/**
 * 关于紫喵园
 */
const APP_VERSION = '2.0.0';

Page({
  data: {
    version: APP_VERSION,
    githubUrl: 'https://github.com/ty-yqs/ZiMiaoYuan',
  },

  onLoad() {
    wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] });
  },

  /** 复制 GitHub 链接 */
  onCopyGithub() {
    wx.setClipboardData({
      data: this.data.githubUrl,
      success: () => {
        wx.showToast({ title: '已复制链接', icon: 'success' });
      },
    });
  },

  onShareAppMessage() {
    return {
      title: '紫喵园 — 校园猫咪数字档案平台',
      path: '/pages/index/index',
    };
  },
});
