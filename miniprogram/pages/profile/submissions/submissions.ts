/**
 * 我的提交页
 *
 * 展示当前用户的所有提交记录（猫咪、记录、编辑提案）及其审核状态
 */
import { apiGetMySubmissions } from '../../../utils/api';

const app = getApp<IAppOption>();

// 状态标签映射
const STATUS_TAG_MAP: Record<string, { type: string; text: string }> = {
  pending: { type: 'warning', text: '审核中' },
  approved: { type: 'success', text: '已通过' },
  rejected: { type: 'danger', text: '已拒绝' },
};

// 记录类型标签
const RECORD_TYPE_LABELS: Record<string, string> = {
  photo: '照片',
  note: '便利贴',
};

Page({
  data: {
    activeTab: 0,

    // 三个列表
    cats: [] as any[],
    records: [] as any[],
    editProposals: [] as any[],

    loading: true,
    error: '',
  },

  onLoad() {
    this.loadSubmissions();
  },

  async loadSubmissions() {
    this.setData({ loading: true, error: '' });

    try {
      const res = await apiGetMySubmissions();

      if (res.code === 0) {
        const { cats, records, editProposals } = res.data;

        this.setData({
          cats: this.formatCats(cats || []),
          records: this.formatRecords(records || []),
          editProposals: this.formatEditProposals(editProposals || []),
          loading: false,
        });
      } else {
        this.setData({
          error: res.message || '加载失败',
          loading: false,
        });
      }
    } catch (err) {
      console.error('[MySubmissions] 加载失败:', err);
      this.setData({
        error: '网络异常，请重试',
        loading: false,
      });
    }
  },

  /** 格式化猫咪列表 */
  formatCats(cats: any[]): any[] {
    return cats.map(cat => ({
      ...cat,
      statusTag: STATUS_TAG_MAP[cat.status] || { type: 'default', text: cat.status || '未知' },
      createTimeText: this.formatTime(cat.createTime),
      avatar: cat.avatar || (cat.photos && cat.photos[0]) || '',
    }));
  },

  /** 格式化记录列表 */
  formatRecords(records: any[]): any[] {
    return records.map(record => ({
      ...record,
      statusTag: STATUS_TAG_MAP[record.status] || { type: 'default', text: record.status || '未知' },
      createTimeText: this.formatTime(record.createTime),
      typeLabel: RECORD_TYPE_LABELS[record.type] || (record.type || '📸 照片'),
    }));
  },

  /** 格式化编辑提案列表 */
  formatEditProposals(proposals: any[]): any[] {
    return proposals.map(proposal => {
      // 提取变更字段摘要
      const changes: string[] = [];
      if (proposal.proposedChanges) {
        const fieldLabels: Record<string, string> = {
          cat_name: '名字',
          color: '毛色',
          gender: '性别',
          age: '年龄',
          description: '描述',
          health: '健康状态',
        };
        for (const [key, value] of Object.entries(proposal.proposedChanges)) {
          const label = fieldLabels[key] || key;
          if (key === 'health') {
            const h = value as any;
            const parts: string[] = [];
            if (h.sterilized !== undefined) parts.push(h.sterilized ? '已绝育' : '未绝育');
            if (h.vaccinated !== undefined) parts.push(h.vaccinated ? '已疫苗' : '未疫苗');
            changes.push(`${label}: ${parts.join('、') || '无变更'}`);
          } else {
            changes.push(`${label}: ${value}`);
          }
        }
      }

      return {
        ...proposal,
        statusTag: STATUS_TAG_MAP[proposal.status] || { type: 'default', text: proposal.status || '未知' },
        createTimeText: this.formatTime(proposal.createTime),
        changesSummary: changes.length > 0 ? changes.join('；') : '无字段变更',
      };
    });
  },

  /** 格式化时间 */
  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    // 1分钟内
    if (diff < 60 * 1000) return '刚刚';
    // 1小时内
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`;
    // 24小时内
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
    // 7天内
    if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))}天前`;

    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${month}月${day}日`;
  },

  /** Tab 切换 */
  onTabChange(e: WechatMiniprogram.TouchEvent) {
    this.setData({ activeTab: e.detail.index });
  },

  /** 点击猫咪，仅已通过的跳转详情 */
  onTapCat(e: WechatMiniprogram.TouchEvent) {
    const { id, status } = e.currentTarget.dataset;
    if (status !== 'approved') return;
    if (id) {
      wx.navigateTo({ url: `/pages/cats/detail/detail?catId=${id}` });
    }
  },

  /** 点击记录关联的猫咪（仅已通过） */
  onTapRecordCat(e: WechatMiniprogram.TouchEvent) {
    const { catid, status } = e.currentTarget.dataset;
    if (status !== 'approved') return;
    if (catid) {
      wx.navigateTo({ url: `/pages/cats/detail/detail?catId=${catid}` });
    }
  },

  /** 点击编辑提案关联的猫咪（仅已通过） */
  onTapProposalCat(e: WechatMiniprogram.TouchEvent) {
    const { catid, status } = e.currentTarget.dataset;
    if (status !== 'approved') return;
    if (catid) {
      wx.navigateTo({ url: `/pages/cats/detail/detail?catId=${catid}` });
    }
  },
});
