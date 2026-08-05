/**
 * 个人中心
 *
 * 显示用户信息、贡献统计、管理员入口
 */
import { apiGetCats } from '../../utils/api';
import { ROUTES } from '../../utils/constants';

const app = getApp<IAppOption>();

Page({
  data: {
    userInfo: null as IUser | null,
    isAdmin: false,
    isLoggedIn: false,

    // 贡献统计
    stats: {
      catCount: 0,
      recordCount: 0,
    },

    loading: true,
    showVersion: '1.0.0 MVP',
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    // 每次显示时刷新
    const { userInfo, isAdmin } = app.globalData;
    if (userInfo) {
      this.setData({
        userInfo,
        isAdmin,
        isLoggedIn: true,
      });
      this.loadUserStats();
    }
  },

  /** 加载用户信息 */
  async loadUserInfo() {
    this.setData({ loading: true });

    const { userInfo, isAdmin } = app.globalData;

    if (userInfo) {
      this.setData({
        userInfo,
        isAdmin,
        isLoggedIn: true,
      });
      await this.loadUserStats();
    } else {
      // 尝试重新登录
      const user = await app.checkLoginStatus();
      if (user) {
        this.setData({
          userInfo: user,
          isAdmin: user.role === 'admin',
          isLoggedIn: true,
        });
        await this.loadUserStats();
      } else {
        this.setData({ isLoggedIn: false });
      }
    }

    this.setData({ loading: false });
  },

  /** 加载用户贡献统计 */
  async loadUserStats() {
    try {
      // 调用云函数获取当前用户的猫咪和记录数量
      // 这里简化处理，实际通过云函数统计
      // TODO: 在云函数 login 中返回统计信息
      this.setData({
        stats: {
          catCount: 0,
          recordCount: 0,
        },
      });
    } catch (err) {
      console.error('[Profile] 加载统计失败:', err);
    }
  },

  /** 获取头像 */
  async onGetAvatar(e: WechatMiniprogram.CustomEvent) {
    const { avatarUrl } = e.detail;
    // 上传到云存储
    try {
      const cloudPath = `users/avatars/${Date.now()}.jpg`;
      const res = await wx.cloud.uploadFile({
        cloudPath,
        filePath: avatarUrl,
      });
      // TODO: 调用云函数更新用户头像
      console.log('[Profile] 头像上传成功:', res.fileID);
    } catch (err) {
      console.error('[Profile] 头像上传失败:', err);
    }
  },

  /** 跳转管理员页面 */
  onGoAdmin() {
    wx.navigateTo({ url: ROUTES.ADMIN });
  },

  /** 关于小程序 */
  onAbout() {
    wx.showModal({
      title: '关于深理猫谱',
      content: '深理猫谱 — 校园猫咪数字档案平台\n\n记录校园里每一只可爱的猫咪 🐱\n\nVersion 1.0.0 MVP',
      showCancel: false,
    });
  },
});
