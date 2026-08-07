/**
 * 编辑猫咪信息页
 *
 * 用户可修改猫咪基本信息，提交后需管理员审核
 */
import { apiGetCatDetail, apiProposeEdit, apiGetCats } from '../../../utils/api';
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

    // 关系管理
    relationships: [] as IRelationship[],
    pendingRelAdds: [] as Array<{
      otherCat: ICat;
      type: string;
      label: string;
      parentIsCurrent: boolean;
      description: string;
    }>,
    relationshipLoading: false,

    // 添加关系弹窗
    showRelationshipModal: false,
    relSearchKeyword: '',
    relSearchResults: [] as ICat[],
    relSearching: false,
    relSelectedCat: null as ICat | null,
    relSelectedType: '',
    relParentIsCurrent: true,
    relDescription: '',
    relSubmitting: false,

    // UI 状态
    loading: true,
    error: '',
    showColorPicker: false,
    showGenderPicker: false,
    showAgePicker: false,

    // 关系类型选项
    relationshipTypes: [
      { label: '💕 伴侣', value: 'mate' },
      { label: '💔 前伴侣', value: 'ex_mate' },
      { label: '👨‍👩‍👧 亲子', value: 'parent_child' },
      { label: '🐱 兄弟姐妹', value: 'sibling' },
      { label: '🤝 好朋友', value: 'friend' },
      { label: '⚡ 对头', value: 'rival' },
      { label: '💬 其他', value: 'other' },
    ] as { label: string; value: string }[],
  },

  /** 空方法，阻止事件冒泡 */
  noop() {},

  onLoad(options: Record<string, string>) {
    wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] });
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
        // 加载关系数据（已在云函数中填充）
        relationships: res.data.relationships || [],
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

  /** 根据关系类型和双方性别计算标签 */
  getRelLabel(type: string, cat1Gender: string, cat2Gender: string, parentIsCurrent: boolean): string {
    switch (type) {
      case 'parent_child': {
        const parentGender = parentIsCurrent ? cat1Gender : cat2Gender;
        const childGender = parentIsCurrent ? cat2Gender : cat1Gender;
        if (parentGender === 'female' && childGender === 'female') return '母女';
        if (parentGender === 'male' && childGender === 'male') return '父子';
        if (parentGender === 'female' && childGender === 'male') return '母子';
        if (parentGender === 'male' && childGender === 'female') return '父女';
        return '亲子';
      }
      case 'sibling': {
        if (cat1Gender === 'male' && cat2Gender === 'male') return '兄弟';
        if (cat1Gender === 'female' && cat2Gender === 'female') return '姐妹';
        if ((cat1Gender === 'male' && cat2Gender === 'female') || (cat1Gender === 'female' && cat2Gender === 'male')) return '兄妹';
        return '兄弟姐妹';
      }
      case 'mate': return '伴侣';
      case 'ex_mate': return '前伴侣';
      case 'friend': return '好朋友';
      case 'rival': return '对头';
      case 'other': return '其他';
      default: return '关联';
    }
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

    // 关系变更（仅添加，纳入审核）
    const proposedRelationshipChanges: Record<string, any> = {};
    if (this.data.pendingRelAdds.length > 0) {
      proposedRelationshipChanges.add = this.data.pendingRelAdds.map(a => ({
        otherCatId: a.otherCat._id,
        otherCatName: a.otherCat.cat_name,
        type: a.type,
        parentIsCurrent: a.parentIsCurrent,
        description: a.description,
      }));
    }

    try {
      const res = await apiProposeEdit({
        catId: this.data.catId,
        updates,
        proposedRelationshipChanges,
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

  // ============ 猫咪关系管理 ============

  /** 显示添加关系弹窗 */
  onShowRelationshipModal() {
    this.setData({
      showRelationshipModal: true,
      relSearchKeyword: '',
      relSearchResults: [],
      relSelectedCat: null,
      relSelectedType: '',
      relParentIsCurrent: true,
      relDescription: '',
    });
  },

  /** 关闭添加关系弹窗 */
  onCloseRelationshipModal() {
    this.setData({ showRelationshipModal: false });
  },

  /** 搜索框输入（同步更新 value，异步搜索） */
  onRelSearchInput(e: WechatMiniprogram.Input) {
    const keyword = e.detail.value || '';
    this.setData({ relSearchKeyword: keyword });

    if (!keyword.trim()) {
      this.setData({ relSearchResults: [], relSelectedCat: null });
      return;
    }

    // 异步搜索（防抖 300ms）
    if (this._relSearchTimer) {
      clearTimeout(this._relSearchTimer);
    }
    this._relSearchTimer = setTimeout(() => {
      this._doRelSearch(keyword.trim());
    }, 300);
  },

  /** 执行猫咪搜索 */
  async _doRelSearch(keyword: string) {
    this.setData({ relSearching: true });

    try {
      const res = await apiGetCats({ keyword, page: 1, pageSize: 20 });
      if (res.code === 0) {
        // 过滤掉当前猫自己、已有关系的猫、以及待添加的猫
        const existingCatIds = new Set(
          this.data.relationships.map((r: IRelationship) => r.otherCat._id)
        );
        this.data.pendingRelAdds.forEach(a => existingCatIds.add(a.otherCat._id));
        existingCatIds.add(this.data.catId);

        const results = (res.data.cats || []).filter(
          (c: ICat) => !existingCatIds.has(c._id)
        );
        this.setData({ relSearchResults: results });
      }
    } catch (err) {
      console.error('[Edit] 搜索猫咪失败:', err);
    }

    this.setData({ relSearching: false });
  },

  /** 选中搜索结果中的猫咪 */
  onSelectSearchCat(e: WechatMiniprogram.TouchEvent) {
    const { cat } = e.currentTarget.dataset;
    this.setData({ relSelectedCat: cat });
  },

  /** 选择关系类型 */
  onSelectRelType(e: WechatMiniprogram.TouchEvent) {
    this.setData({ relSelectedType: e.currentTarget.dataset.type });
  },

  /** 切换 parent_child 的亲子方向 */
  onToggleParentDirection() {
    this.setData({ relParentIsCurrent: !this.data.relParentIsCurrent });
  },

  /** 其他关系描述输入 */
  onRelDescInput(e: WechatMiniprogram.Input) {
    this.setData({ relDescription: e.detail.value || '' });
  },

  /** 提交添加关系 → 存入待审核列表 */
  onSubmitRelationship() {
    if (!requireProfile()) return;

    const { relSelectedCat, relSelectedType, relParentIsCurrent, relDescription } = this.data;

    if (!relSelectedCat) {
      showToast('请选择一只猫咪', 'none');
      return;
    }
    if (!relSelectedType) {
      showToast('请选择关系类型', 'none');
      return;
    }

    const label = this.getRelLabel(relSelectedType, this.data.gender, relSelectedCat.gender, relParentIsCurrent);

    const pendingAdds = this.data.pendingRelAdds.concat([{
      otherCat: relSelectedCat,
      type: relSelectedType,
      label,
      parentIsCurrent: relParentIsCurrent,
      description: relSelectedType === 'other' ? relDescription.trim() : '',
    }]);

    this.setData({ pendingRelAdds: pendingAdds });
    this.onCloseRelationshipModal();
  },

  /** 撤销待添加的关系 */
  onUndoPendingRelAdd(e: WechatMiniprogram.TouchEvent) {
    const { index } = e.currentTarget.dataset;
    const pendingAdds = this.data.pendingRelAdds.filter((_, i) => i !== index);
    this.setData({ pendingRelAdds: pendingAdds });
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
