/**
 * 个人中心
 *
 * 显示用户信息、贡献统计、管理员入口
 */
import { ROUTES } from '../../utils/constants';
import { apiGetUserStats, apiGetPendingCounts, apiUpdateUser } from '../../utils/api';
import { getCachedImageUrl, getCacheSize, clearImageCache } from '../../utils/imageCache';
import { showToast, showConfirm, showLoading, hideLoading, requireProfile } from '../../utils/util';

const app = getApp<IAppOption>();

Page({
  data: {
    userInfo: null as IUser | null,
    isAdmin: false,
    isLoggedIn: false,

    // 用户头像缓存后的本地路径
    cachedAvatar: '',

    // 贡献统计
    stats: {
      catCount: 0,
      recordCount: 0,
    },

    // 待审核角标
    pendingCount: 0,

    // 缓存信息
    cacheSize: '计算中...',
    cacheCount: 0,

    loading: true,
    showVersion: '2.1.0',
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }

    // 检查是否已设置昵称和头像
    if (!requireProfile()) return;

    // 每次显示时刷新
    const { userInfo, isAdmin } = app.globalData;
    if (userInfo) {
      this.setData({
        userInfo,
        isAdmin,
        isLoggedIn: true,
      });
      this.loadUserStats();
      this.loadCacheSize();
      this.loadCachedAvatar(userInfo.avatar);
      this.loadPendingCounts();
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
      this.loadCacheSize();
      this.loadCachedAvatar(userInfo.avatar);
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
        this.loadCacheSize();
        this.loadCachedAvatar(user.avatar);
        this.loadPendingCounts();
      } else {
        this.setData({ isLoggedIn: false });
      }
    }

    this.setData({ loading: false });
  },

  /** 加载缓存的头像 */
  async loadCachedAvatar(avatar: string | undefined) {
    if (!avatar) return;
    const cached = await getCachedImageUrl(avatar);
    if (cached) {
      this.setData({ cachedAvatar: cached });
    }
  },

  /** 加载用户贡献统计 */
  async loadUserStats() {
    try {
      const res = await apiGetUserStats();
      if (res.code === 0 && res.data) {
        this.setData({
          stats: {
            catCount: res.data.catCount || 0,
            recordCount: res.data.recordCount || 0,
          },
        });
      }
    } catch (err) {
      console.error('[Profile] 加载统计失败:', err);
    }
  },

  /** 加载待审核数量（仅管理员） */
  async loadPendingCounts() {
    if (!this.data.isAdmin) return;
    try {
      const res = await apiGetPendingCounts();
      if (res.code === 0 && res.data) {
        this.setData({ pendingCount: res.data.total || 0 });
      }
    } catch (err) {
      console.error('[Profile] 加载待审核数量失败:', err);
    }
  },

  /** 加载缓存大小 */
  async loadCacheSize() {
    try {
      const { count, sizeFormatted } = await getCacheSize();
      this.setData({
        cacheSize: sizeFormatted,
        cacheCount: count,
      });
    } catch (err) {
      console.error('[Profile] 获取缓存大小失败:', err);
    }
  },

  /** 更新头像 */
  async onGetAvatar(e: WechatMiniprogram.CustomEvent) {
    const { avatarUrl } = e.detail;
    showLoading('上传中...');
    try {
      // 先压缩头像（减少存储和流量）
      const compressRes = await wx.compressImage({ src: avatarUrl, quality: 80 });
      const cloudPath = `users/avatars/${Date.now()}.jpg`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: compressRes.tempFilePath,
      });

      // 调用云函数更新用户头像
      const updateRes = await apiUpdateUser({ avatar: uploadRes.fileID });

      hideLoading();

      if (updateRes.code === 0 && updateRes.data) {
        // 更新全局状态
        app.globalData.userInfo = updateRes.data;
        wx.setStorageSync('userInfo', updateRes.data);

        // 更新页面数据
        this.setData({
          userInfo: updateRes.data,
          cachedAvatar: '', // 先清空以触发重新缓存
        });

        showToast('头像更新成功', 'success');

        // 重新加载缓存头像
        setTimeout(() => {
          if (updateRes.data?.avatar) {
            this.loadCachedAvatar(updateRes.data.avatar);
          }
        }, 300);
      } else {
        showToast(updateRes.message || '头像更新失败', 'error');
      }
    } catch (err) {
      hideLoading();
      console.error('[Profile] 头像上传失败:', err);
      showToast('头像上传失败，请重试', 'error');
    }
  },

  /** 点击头像或昵称，跳转编辑个人信息 */
  onEditProfile() {
    wx.navigateTo({ url: ROUTES.LOGIN });
  },

  /** 清除图片缓存 */
  async onClearCache() {
    if (this.data.cacheCount === 0) {
      showToast('暂无缓存数据');
      return;
    }

    const confirmed = await showConfirm(
      `当前缓存了 ${this.data.cacheCount} 张图片（${this.data.cacheSize}），确认清除吗？\n\n清除后图片将重新从云端加载。`,
      '清除缓存'
    );

    if (!confirmed) return;

    try {
      const { clearedCount } = await clearImageCache();
      showToast(`已清除 ${clearedCount} 张缓存图片`, 'success');
      this.setData({
        cacheSize: '0 B',
        cacheCount: 0,
        cachedAvatar: '',
      });
      // 延迟刷新头像缓存
      setTimeout(() => {
        const { userInfo } = this.data;
        if (userInfo?.avatar) {
          this.loadCachedAvatar(userInfo.avatar);
        }
        this.loadCacheSize();
      }, 500);
    } catch (err) {
      console.error('[Profile] 清除缓存失败:', err);
      showToast('清除失败，请重试', 'error');
    }
  },

  /** 跳转我的提交页 */
  onMySubmissions() {
    wx.navigateTo({ url: ROUTES.MY_SUBMISSIONS });
  },

  /** 跳转管理员页面 */
  onGoAdmin() {
    wx.navigateTo({ url: ROUTES.ADMIN });
  },

  /** 关于小程序 */
  onAbout() {
    wx.navigateTo({ url: ROUTES.ABOUT });
  },
});
