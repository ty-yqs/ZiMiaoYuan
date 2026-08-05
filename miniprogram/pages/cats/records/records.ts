/**
 * 发现记录 / 便利贴 完整列表页
 */
import { apiGetCatDetail } from '../../../utils/api';
import { formatDate, showToast } from '../../../utils/util';

Page({
  data: {
    catId: '',
    type: 'photo' as 'photo' | 'note',  // 'photo' = 发现记录, 'note' = 便利贴
    items: [] as IRecord[],
    loading: true,
    error: '',
    catName: '',
  },

  onLoad(options: Record<string, string>) {
    const { catId, type } = options;
    if (catId) {
      this.setData({ catId, type: type || 'photo' });
      const title = type === 'note' ? '便利贴' : '发现记录';
      wx.setNavigationBarTitle({ title });
      this.loadItems();
    } else {
      this.setData({ error: '参数错误', loading: false });
    }
  },

  async loadItems() {
    this.setData({ loading: true, error: '' });

    const res = await apiGetCatDetail(this.data.catId);

    if (res.code === 0) {
      const { cat, records } = res.data;
      const allRecords = records || [];
      const items = this.data.type === 'note'
        ? allRecords.filter((r: IRecord) => r.type === 'note')
        : allRecords.filter((r: IRecord) => !r.type || r.type !== 'note');

      this.setData({
        items,
        catName: cat?.cat_name || '猫咪',
        loading: false,
      });
    } else {
      this.setData({
        error: res.message || '加载失败',
        loading: false,
      });
    }
  },

  formatDate(date: Date | string): string {
    return formatDate(date, 'YYYY-MM-DD HH:mm');
  },
});
