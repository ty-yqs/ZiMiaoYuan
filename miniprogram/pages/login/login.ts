/**
 * 登录引导页
 *
 * 首次使用或未设置昵称/头像时弹出，
 * 引导用户设置昵称和头像。
 */
import { apiUpdateUser } from '../../utils/api';
import { showToast, showLoading, hideLoading } from '../../utils/util';

const app = getApp<IAppOption>();

Page({
  data: {
    avatarUrl: '',
    nickname: '',
    submitting: false,
    canSubmit: false,
    isNewAvatar: false, // 是否选择了新头像（临时文件）
  },

  onLoad() {
    // 预填已有信息
    const user = app.globalData.userInfo;
    if (user) {
      const hasAvatar = !!(user.avatar);
      this.setData({
        avatarUrl: user.avatar || '',
        nickname: user.nickname || '',
        canSubmit: hasAvatar && !!user.nickname,
      });
    }
  },

  /** 选择头像 */
  onChooseAvatar(e: WechatMiniprogram.CustomEvent) {
    const { avatarUrl } = e.detail;
    this.setData({ avatarUrl, isNewAvatar: true });
    this.checkCanSubmit();
  },

  /** 输入昵称 */
  onNicknameInput(e: WechatMiniprogram.Input) {
    this.setData({ nickname: e.detail.value });
    this.checkCanSubmit();
  },

  /** 昵称输入框失焦时更新 */
  onNicknameBlur(e: WechatMiniprogram.Input) {
    this.setData({ nickname: e.detail.value });
    this.checkCanSubmit();
  },

  /** 检查是否可以提交 */
  checkCanSubmit() {
    const { avatarUrl, nickname } = this.data;
    this.setData({ canSubmit: !!(avatarUrl && nickname.trim()) });
  },

  /** 提交 */
  async onSubmit() {
    if (!this.data.canSubmit || this.data.submitting) return;

    this.setData({ submitting: true });
    showLoading('保存中...');

    try {
      const nickname = this.data.nickname.trim();
      let avatar = '';

      // 上传头像到云存储（仅当选择了新头像，临时文件才需要上传）
      if (this.data.avatarUrl) {
        if (this.data.isNewAvatar) {
          const cloudPath = `users/avatars/${Date.now()}.jpg`;
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath,
            filePath: this.data.avatarUrl,
          });
          avatar = uploadRes.fileID;
        } else {
          // 未更换头像，沿用原有的 cloud:// fileID
          avatar = this.data.avatarUrl;
        }
      }

      // 调用云函数更新用户信息
      const res = await apiUpdateUser({ nickname, avatar });

      hideLoading();

      if (res.code === 0 && res.data) {
        // 更新全局状态
        app.globalData.userInfo = res.data;
        wx.setStorageSync('userInfo', res.data);

        showToast('设置完成', 'success');
        setTimeout(() => wx.navigateBack(), 1200);
      } else {
        showToast(res.message || '保存失败', 'error');
        this.setData({ submitting: false });
      }
    } catch (err) {
      hideLoading();
      console.error('[Login] 保存失败:', err);
      showToast('网络异常，请重试', 'error');
      this.setData({ submitting: false });
    }
  },

  /** 稍后设置 */
  onSkip() {
    wx.navigateBack();
  },
});
