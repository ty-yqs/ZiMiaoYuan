/**
 * 上传发现猫咪页
 *
 * 用户可以：
 * - 选择图片
 * - 填写猫咪信息
 * - 上传到云存储
 * - 保存到数据库
 */
import { apiAddCat, apiUploadRecord, apiGetSettings } from '../../utils/api';
import { showToast, showLoading, hideLoading, chooseImage, requireProfile } from '../../utils/util';
const config = require('../../config/index');
const app = getApp<IAppOption>();

// 审核结果通知模板ID
const SUBSCRIBE_TMPL_ID = 'ImPQfyZeWGBqwauOUmFfI7SiCXfiNgrgb_CDt7v7U-Q';

Page({
  data: {
    // 是否为已有猫咪添加记录
    targetCatId: '',
    maxPhotos: 3,

    // 表单数据
    photos: [] as string[],           // 临时文件路径
    cat_name: '',
    color: '',
    gender: '',
    age: '',
    description: '',
    health: {
      sterilized: false,
      vaccinated: false,
    },

    // 选项
    colorOptions: config.CAT_COLORS.map(c => ({ text: c, value: c })),
    genderOptions: config.GENDER_OPTIONS,
    ageOptions: config.AGE_OPTIONS,

    // UI 状态
    submitting: false,
    showColorPicker: false,
    showGenderPicker: false,
    showAgePicker: false,

    // 提交开关（进入页面时再次校验，关闭则禁止提交）
    submitDisabled: false,
    submitDisabledTip: '',
  },

  onLoad(options: Record<string, string>) {
    wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] });
    if (options.catId) {
      this.setData({ targetCatId: options.catId, maxPhotos: 3 });
      wx.setNavigationBarTitle({ title: '记录发现' });
    }
    this.checkSubmitPermission();
  },

  /** 进入提交页时再次校验提交开关（新增猫咪→uploadOpen，发现记录→recordsOpen） */
  async checkSubmitPermission() {
    const res = await apiGetSettings();
    if (res.code !== 0 || !res.data) return;
    const isRecord = !!this.data.targetCatId;
    const allowed = isRecord
      ? res.data.recordsOpen === true
      : res.data.uploadOpen === true;
    if (!allowed) {
      this.setData({
        submitDisabled: true,
        submitDisabledTip: isRecord ? '当前暂不开放提交发现记录' : '当前暂不开放提交新猫咪',
      });
    }
  },

  /** 表单输入 */
  onFieldChange(e: WechatMiniprogram.CustomEvent) {
    const { field } = e.currentTarget.dataset;
    if (field) {
      this.setData({ [field]: e.detail });
    }
  },

  /** 选择图片 */
  async onChooseImage() {
    try {
      const maxCount = this.data.maxPhotos;
      const remaining = maxCount - this.data.photos.length;
      if (remaining <= 0) {
        showToast(`最多上传${maxCount}张图片`, 'error');
        return;
      }
      const res = await chooseImage(remaining);
      this.setData({
        photos: [...this.data.photos, ...res.tempFilePaths],
      });
    } catch (err) {
      // 用户取消选择
    }
  },

  /** 删除图片 */
  onDeleteImage(e: WechatMiniprogram.TouchEvent) {
    const { index } = e.currentTarget.dataset;
    const photos = [...this.data.photos];
    photos.splice(index, 1);
    this.setData({ photos });
  },

  /** 压缩图片列表，返回压缩后的临时文件路径 */
  compressImages(filePaths: string[]): Promise<string[]> {
    return Promise.all(
      filePaths.map(path =>
        wx.compressImage({ src: path, quality: 80 }).then(res => res.tempFilePath)
      )
    );
  },

  /** 提交表单 */
  async onSubmit() {
    // 检查是否已设置昵称和头像
    if (!requireProfile()) return;

    // 提交开关已关闭则拦截
    if (this.data.submitDisabled) {
      showToast(this.data.submitDisabledTip);
      return;
    }

    // 验证：图片始终必填
    if (this.data.photos.length === 0) {
      showToast('请至少选择一张图片', 'error');
      return;
    }

    // 新建猫咪模式：除备注外均必填
    if (!this.data.targetCatId) {
      if (!this.data.color) {
        showToast('请选择猫咪毛色', 'error');
        return;
      }
      if (!this.data.gender) {
        showToast('请选择猫咪性别', 'error');
        return;
      }
      if (!this.data.age) {
        showToast('请选择猫咪年龄', 'error');
        return;
      }
    }

    if (this.data.submitting) return;

    // 必须在 tap 手势回调中直接调用，不能等异步完成后
    this.requestSubscribe();

    this.setData({ submitting: true });
    showLoading('压缩中...');

    try {
      // Step 1: 压缩图片（减少上行流量和存储占用）
      const compressedPaths = await this.compressImages(this.data.photos);

      // Step 2: 上传图片到云存储
      showLoading('上传中...');
      const cloudFileIds: string[] = [];
      for (const filePath of compressedPaths) {
        const cloudPath = `${config.STORAGE_PREFIX.CAT_PHOTO}${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath });
        cloudFileIds.push(uploadRes.fileID);
      }

      // Step 3: 如果是为已有猫咪添加记录
      if (this.data.targetCatId) {
        const res = await apiUploadRecord({
          catId: this.data.targetCatId,
          photos: cloudFileIds,
        });

        hideLoading();

        if (res.code === 0) {
          showToast('记录成功，等待管理员审核', 'success');
          setTimeout(() => wx.navigateBack(), 1500);
        } else {
          showToast(res.message || '提交失败', 'error');
        }
      } else {
        // Step 4: 新建猫咪 + 记录
        const res = await apiAddCat({
          cat_name: this.data.cat_name,
          photos: cloudFileIds,
          avatar: cloudFileIds[0], // 第一张作为头像
          gender: this.data.gender || 'unknown',
          age: this.data.age || 'unknown',
          color: this.data.color,
          description: this.data.description,
          health: this.data.health,
        });

        // 先隐藏 loading，再显示结果 toast（两者共享原生组件，否则 hideLoading 会关掉 toast）
        hideLoading();

        if (res.code === 0) {
          showToast('提交成功，等待审核', 'success');
          setTimeout(() => wx.navigateBack(), 2500);
        } else {
          showToast(res.message || '提交失败', 'error');
        }
      }

    } catch (err: any) {
      console.error('[Upload] 提交失败:', err);
      hideLoading();
      showToast('网络异常，请重试', 'error');
    } finally {
      this.setData({ submitting: false });
    }
  },

  // ============ 健康状态 ============
  onToggleSterilized() {
    this.setData({ 'health.sterilized': !this.data.health.sterilized });
  },
  onToggleVaccinated() {
    this.setData({ 'health.vaccinated': !this.data.health.vaccinated });
  },

  /** 请求订阅审核结果通知 */
  requestSubscribe() {
    wx.requestSubscribeMessage({
      tmplIds: [SUBSCRIBE_TMPL_ID],
      success: (res: any) => {
        console.log('[Upload] 订阅结果:', res);
      },
      fail: (err: any) => {
        console.log('[Upload] 订阅失败:', err);
      },
    });
  },

  onShareAppMessage() {
    return { title: '发现猫咪', path: '/pages/upload/upload' };
  },

  // ============ 选择器 ============
  onShowColorPicker() {
    this.setData({ showColorPicker: true });
  },
  onCloseColorPicker() {
    this.setData({ showColorPicker: false });
  },
  onSelectColor(e: WechatMiniprogram.TouchEvent) {
    const { value } = e.currentTarget.dataset;
    this.setData({ color: value, showColorPicker: false });
  },
  onShowGenderPicker() {
    this.setData({ showGenderPicker: true });
  },
  onCloseGenderPicker() {
    this.setData({ showGenderPicker: false });
  },
  onSelectGender(e: WechatMiniprogram.TouchEvent) {
    const { value } = e.currentTarget.dataset;
    this.setData({ gender: value, showGenderPicker: false });
  },
  onShowAgePicker() {
    this.setData({ showAgePicker: true });
  },
  onCloseAgePicker() {
    this.setData({ showAgePicker: false });
  },
  onSelectAge(e: WechatMiniprogram.TouchEvent) {
    const { value } = e.currentTarget.dataset;
    this.setData({ age: value, showAgePicker: false });
  },
});
