/**
 * 深理猫谱 - 应用入口
 *
 * 初始化云开发环境，处理登录逻辑，
 * 全局状态管理。
 */

const config = require('./config/index');

App<IAppOption>({
  globalData: {
    env: config.ENV_ID,
    userInfo: undefined,
    isAdmin: false,
  },

  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('[App] 请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }

    wx.cloud.init({
      env: config.ENV_ID || undefined,
      traceUser: true,
    });

    // 预登录
    this.checkLoginStatus();
  },

  /**
   * 检查登录状态，尝试获取用户信息
   */
  async checkLoginStatus(): Promise<IUser | null> {
    try {
      // 先从缓存读取
      const cached = wx.getStorageSync('userInfo');
      if (cached) {
        this.globalData.userInfo = cached;
        this.globalData.isAdmin = cached.role === 'admin';
      }

      // 异步调用云函数获取最新用户信息
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: {},
      });

      const result = res.result as ICloudResult<IUser>;

      if (result.code === 0 && result.data) {
        this.globalData.userInfo = result.data;
        this.globalData.isAdmin = result.data.role === 'admin';

        // 缓存到本地
        wx.setStorageSync('userInfo', result.data);
        console.log('[App] 登录成功，用户角色:', result.data.role);
        return result.data;
      }

      console.warn('[App] 登录异常:', result.message);
      return null;
    } catch (err) {
      console.error('[App] 登录失败:', err);
      return null;
    }
  },
});
