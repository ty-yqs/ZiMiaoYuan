/**
 * 编辑猫咪信息页
 *
 * 用户可修改猫咪基本信息，提交后需管理员审核
 */
import { apiGetCatDetail, apiProposeEdit } from '../../../utils/api';
import { showToast, showLoading, hideLoading, requireProfile } from '../../../utils/util';
const config = require('../../../config/index');

const app = getApp<IAppOption>();

Page({
  data: {
    catId: '',
    submitting: false,

    // 表单数据（预填当前值）
    cat_name: '',
    color: '',
    gender: '',
    age: '',
    description: '',

    // 选项
    colorOptions: config.CAT_COLORS.map((c: string) => ({ text: c, value: c })),
    genderOptions: config.GENDER_OPTIONS,
    ageOptions: config.AGE_OPTIONS,

    // 健康状态
    healthSterilized: false,
    healthVaccinated: false,

    // 标签映射
    genderLabel: '',
    ageLabel: '',

    // UI 状态
    loading: true,
    error: '',
    showColorPicker: false,
    showGenderPicker: false,
    showAgePicker: false,
  },

  /** 空方法，阻止事件冒泡 */
  noop() {},

  onLoad(options: Record<string, string>) {
    const { catId } = options;
    if (!catId) {
      this.setData({ error: '猫咪不存在', loading: false });
      return;
    }
    this.setData({ catId });
    this.loadCatInfo();
  },

  /** 加载猫咪当前信息，预填表单 */
  async loadCatInfo() {
    this.setData({ loading: true });
    const res = await apiGetCatDetail(this.data.catId);

    if (res.code === 0) {
      const { cat } = res.data;
      this.setData({
        cat_name: cat.cat_name || '',
        color: cat.color || '',
        gender: cat.gender || '',
        age: cat.age || '',
        description: cat.description || '',
        genderLabel: this.getLabel(config.GENDER_OPTIONS, cat.gender),
        ageLabel: this.getLabel(config.AGE_OPTIONS, cat.age),
        healthSterilized: !!(cat.health && cat.health.sterilized),
        healthVaccinated: !!(cat.health && cat.health.vaccinated),
        loading: false,
      });
    } else {
      this.setData({
        error: res.message || '加载失败',
        loading: false,
      });
    }
  },

  /** 表单输入 */
  onFieldChange(e: WechatMiniprogram.Input) {
    const { field } = e.currentTarget.dataset;
    if (field) {
      this.setData({ [field]: e.detail.value });
    }
  },

  /** 获取选项标签 */
  getLabel(options: { label: string; value: string }[], value: string): string {
    const option = options.find(o => o.value === value);
    return option ? option.label : '';
  },

  onShareAppMessage() {
    return { title: '编辑猫咪信息', path: `/pages/cats/edit/edit?catId=${this.data.catId}` };
  },

  /** 提交编辑 */
  async onSubmit() {
    if (!requireProfile()) return;

    if (this.data.submitting) return;
    this.setData({ submitting: true });
    showLoading('提交中...');

    const updates: Record<string, string> = {};
    if (this.data.cat_name) updates.cat_name = this.data.cat_name;
    if (this.data.color) updates.color = this.data.color;
    if (this.data.gender) updates.gender = this.data.gender;
    if (this.data.age) updates.age = this.data.age;
    updates.description = this.data.description; // 允许为空
    updates.health = {
      sterilized: this.data.healthSterilized,
      vaccinated: this.data.healthVaccinated,
    };

    try {
      const res = await apiProposeEdit({
        catId: this.data.catId,
        updates,
      });

      hideLoading();

      if (res.code === 0) {
        showToast('编辑已提交，等待管理员审核', 'success');
        setTimeout(() => wx.navigateBack(), 2000);
      } else {
        showToast(res.message || '提交失败', 'error');
        this.setData({ submitting: false });
      }
    } catch (err) {
      hideLoading();
      showToast('网络异常，请重试', 'error');
      this.setData({ submitting: false });
    }
  },

  // ============ 健康状态 ============
  onToggleSterilized() {
    this.setData({ healthSterilized: !this.data.healthSterilized });
  },
  onToggleVaccinated() {
    this.setData({ healthVaccinated: !this.data.healthVaccinated });
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
    this.setData({
      gender: value,
      genderLabel: this.getLabel(config.GENDER_OPTIONS, value),
      showGenderPicker: false,
    });
  },
  onShowAgePicker() {
    this.setData({ showAgePicker: true });
  },
  onCloseAgePicker() {
    this.setData({ showAgePicker: false });
  },
  onSelectAge(e: WechatMiniprogram.TouchEvent) {
    const { value } = e.currentTarget.dataset;
    this.setData({
      age: value,
      ageLabel: this.getLabel(config.AGE_OPTIONS, value),
      showAgePicker: false,
    });
  },
});
