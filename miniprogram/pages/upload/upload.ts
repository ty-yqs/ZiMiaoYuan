/**
 * 上传发现猫咪页
 *
 * 用户可以：
 * - 选择图片
 * - 填写猫咪信息
 * - 上传到云存储
 * - 保存到数据库
 */
import { apiAddCat, apiUploadRecord } from '../../utils/api';
import { showToast, showLoading, hideLoading, chooseImage, requireProfile } from '../../utils/util';
const config = require('../../config/index');
const app = getApp<IAppOption>();

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
    location: {
      name: '',
      latitude: 0,
      longitude: 0,
    },
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
  },

  onLoad(options: Record<string, string>) {
    if (options.catId) {
      this.setData({ targetCatId: options.catId, maxPhotos: 1 });
      wx.setNavigationBarTitle({ title: '记录发现' });
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
      const maxCount = this.data.targetCatId ? 1 : 3;
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

  /** 选择位置 */
  onChooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          location: {
            name: res.name || res.address || '',
            latitude: res.latitude,
            longitude: res.longitude,
          },
        });
      },
    });
  },

  /** 提交表单 */
  async onSubmit() {
    // 检查是否已设置昵称和头像
    if (!requireProfile()) return;

    // 验证：图片和位置始终必填
    if (this.data.photos.length === 0) {
      showToast('请至少选择一张图片', 'error');
      return;
    }
    if (!this.data.location.name) {
      showToast('请选择发现地点', 'error');
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
          photo: cloudFileIds[0],
          description: this.data.description,
          location: this.data.location,
        });

        // 先隐藏 loading，再显示结果 toast（两者共享原生组件，否则 hideLoading 会关掉 toast）
        hideLoading();

        if (res.code === 0) {
          showToast('记录成功', 'success');
          // 标记详情页需要刷新
          app.globalData.needRefreshDetail = true;
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
          location: this.data.location,
          health: this.data.health,
        });

        // 先隐藏 loading，再显示结果 toast（两者共享原生组件，否则 hideLoading 会关掉 toast）
        hideLoading();

        if (res.code === 0) {
          showToast('提交成功，等待审核', 'success');
          // 延迟需大于 toast duration（2000ms），确保提示语完整展示后再返回
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
