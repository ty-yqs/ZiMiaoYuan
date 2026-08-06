/**
 * 管理员后台
 *
 * 功能：
 * - 审核待审批的猫咪 (pending → approved / rejected)
 * - 查看猫咪完整信息及所有照片
 * - 审核编辑提案
 * - 删除错误数据
 */
import { apiGetCats, apiAdminUpdateCat, apiGetPendingEdits } from '../../utils/api';
import { showToast, showConfirm } from '../../utils/util';
import { getCachedImageUrls } from '../../utils/imageCache';

const app = getApp<IAppOption>();

// 年龄段中文映射
const AGE_LABEL_MAP: Record<string, string> = {
  kitten: '幼猫 (<1岁)',
  adult: '成年猫',
  elderly: '老年猫',
  unknown: '未知',
};

// 性别中文映射
const GENDER_LABEL_MAP: Record<string, string> = {
  male: '公猫 ♂',
  female: '母猫 ♀',
  unknown: '未知',
};

Page({
  data: {
    isAdmin: false,
    activeTab: 0,
    pendingCats: [] as ICat[],
    allCats: [] as ICat[],
    pendingEdits: [] as IEditProposal[],
    loading: true,
    error: '',
  },

  onLoad() {
    wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] });
    if (!app.globalData.isAdmin) {
      wx.showModal({
        title: '权限不足',
        content: '仅管理员可访问此页面',
        showCancel: false,
        success: () => wx.navigateBack(),
      });
      return;
    }
    this.setData({ isAdmin: true });
    this.loadData();
  },

  /** 加载数据 */
  async loadData() {
    this.setData({ loading: true });

    // 加载待审核猫咪
    const pendingRes = await apiGetCats({ status: 'pending', pageSize: 50 });
    if (pendingRes.code === 0) {
      const cats = (pendingRes.data.cats || []).map((cat: ICat) => ({
        ...cat,
        genderLabel: GENDER_LABEL_MAP[cat.gender] || '',
        ageLabel: AGE_LABEL_MAP[cat.age] || '',
      }));
      this.setData({ pendingCats: cats });
      this.cacheAvatars(cats, 'pendingCats');
      this.cachePendingPhotos(cats);
    }

    // 加载全部猫咪
    const allRes = await apiGetCats({ status: 'all', pageSize: 50 });
    if (allRes.code === 0) {
      this.setData({ allCats: allRes.data.cats || [] });
      this.cacheAvatars(allRes.data.cats || [], 'allCats');
    }

    // 加载待审核编辑
    await this.loadPendingEdits();

    this.setData({ loading: false });
  },

  /** 加载待审核编辑提案 */
  async loadPendingEdits() {
    const res = await apiGetPendingEdits();
    if (res.code === 0) {
      const FIELD_LABELS: Record<string, string> = {
        cat_name: '名字',
        color: '毛色',
        gender: '性别',
        age: '年龄段',
        description: '简介',
        health: '健康状态',
      };

      const formatValue = (key: string, value: any): string => {
        if (key === 'health' && typeof value === 'object') {
          const parts: string[] = [];
          if (value.sterilized) parts.push('已绝育'); else parts.push('未绝育');
          if (value.vaccinated) parts.push('已打疫苗'); else parts.push('未打疫苗');
          return parts.join('，');
        }
        return String(value);
      };

      const pendingEdits = (res.data || []).map((edit: IEditProposal) => ({
        ...edit,
        changesList: Object.entries(edit.proposedChanges).map(([key, value]) => ({
          key: FIELD_LABELS[key] || key,
          value: formatValue(key, value),
        })),
      }));
      this.setData({ pendingEdits });
    }
  },

  /** 缓存猫咪头像到本地 */
  async cacheAvatars(cats: ICat[], listKey: string) {
    const cloudIDs = cats
      .map((c) => c.avatar)
      .filter((avatar) => avatar && avatar.startsWith('cloud://'));

    if (cloudIDs.length === 0) return;

    const cachedUrls = await getCachedImageUrls(cloudIDs);

    const urlMap: Record<string, string> = {};
    for (let i = 0; i < cloudIDs.length; i++) {
      if (cachedUrls[i]) {
        urlMap[cloudIDs[i]] = cachedUrls[i];
      }
    }

    const updatedCats = (this.data as any)[listKey].map((cat: ICat) => ({
      ...cat,
      avatar: urlMap[cat.avatar] || cat.avatar,
    }));

    this.setData({ [listKey]: updatedCats });
  },

  /** 缓存待审核猫咪的所有照片 */
  async cachePendingPhotos(cats: ICat[]) {
    // 收集所有需要缓存的 cloud:// 图片（每只猫最多 3 张）
    const allCloudIDs: string[] = [];
    const catPhotoCounts: number[] = [];

    for (const cat of cats) {
      const photos = cat.photos || [];
      catPhotoCounts.push(photos.length);
      allCloudIDs.push(...photos);
    }

    if (allCloudIDs.length === 0) return;

    const cachedUrls = await getCachedImageUrls(allCloudIDs);

    // 映射回每只猫
    let offset = 0;
    const updatedCats = (this.data.pendingCats as any[]).map((cat, idx) => {
      const count = catPhotoCounts[idx] || 0;
      const cachedPhotos: string[] = [];
      for (let i = 0; i < count; i++) {
        cachedPhotos.push(cachedUrls[offset + i] || cat.photos[i]);
      }
      offset += count;
      return { ...cat, cachedPhotos };
    });

    this.setData({ pendingCats: updatedCats });
  },

  // ==================== 审核操作 ====================

  async onApprove(e: WechatMiniprogram.TouchEvent) {
    const { catId } = e.currentTarget.dataset;
    const confirmed = await showConfirm('确认审核通过这只猫咪吗？');
    if (!confirmed) return;

    const res = await apiAdminUpdateCat({ catId, action: 'approve' });

    if (res.code === 0) {
      showToast('已审核通过', 'success');
      this.loadData();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  async onReject(e: WechatMiniprogram.TouchEvent) {
    const { catId } = e.currentTarget.dataset;
    const confirmed = await showConfirm('确认拒绝吗？该猫咪将不会显示在列表中。');
    if (!confirmed) return;

    const res = await apiAdminUpdateCat({ catId, action: 'reject' });

    if (res.code === 0) {
      showToast('已拒绝', 'success');
      this.loadData();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  async onDelete(e: WechatMiniprogram.TouchEvent) {
    const { catId } = e.currentTarget.dataset;
    const confirmed = await showConfirm(
      '删除后数据将无法恢复，确认删除吗？',
      '⚠️ 危险操作'
    );
    if (!confirmed) return;

    const res = await apiAdminUpdateCat({ catId, action: 'delete' });

    if (res.code === 0) {
      showToast('已删除', 'success');
      this.loadData();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  // ==================== 编辑审核 ====================

  async onApproveEdit(e: WechatMiniprogram.TouchEvent) {
    const { proposalId } = e.currentTarget.dataset;
    const confirmed = await showConfirm('确认通过此编辑吗？猫咪信息将被更新。');
    if (!confirmed) return;

    const res = await apiAdminUpdateCat({
      action: 'reviewEdit',
      proposalId,
      decision: 'approve',
    });

    if (res.code === 0) {
      showToast('编辑已通过', 'success');
      this.loadData();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  async onRejectEdit(e: WechatMiniprogram.TouchEvent) {
    const { proposalId } = e.currentTarget.dataset;
    const confirmed = await showConfirm('确认拒绝此编辑吗？猫咪信息将不会变更。');
    if (!confirmed) return;

    const res = await apiAdminUpdateCat({
      action: 'reviewEdit',
      proposalId,
      decision: 'reject',
    });

    if (res.code === 0) {
      showToast('编辑已拒绝', 'success');
      this.loadData();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  /** 预览照片 */
  onPreviewPhotos(e: WechatMiniprogram.TouchEvent) {
    const { url, urls } = e.currentTarget.dataset;
    wx.previewImage({ urls: urls || [url], current: url });
  },

  /** Tab 切换 */
  onTabChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ activeTab: e.detail.index || e.detail.name });
  },

  onShareAppMessage() {
    return { title: '管理后台', path: '/pages/admin/admin' };
  },
});
