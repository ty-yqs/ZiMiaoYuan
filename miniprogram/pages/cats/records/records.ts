/**
 * 发现记录 / 便利贴 完整列表页
 */
import { apiGetCatDetail } from '../../../utils/api';
import { formatDate } from '../../../utils/util';
import { getCachedImageUrls } from '../../../utils/imageCache';

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
    wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] });
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
      const allRecords = (records || []).map((r: IRecord) => ({
        ...r,
        _time: formatDate(r.createTime, 'YYYY-MM-DD HH:mm'),
      }));
      const items = this.data.type === 'note'
        ? allRecords.filter((r: IRecord) => r.type === 'note')
        : allRecords.filter((r: IRecord) => !r.type || r.type !== 'note');

      this.setData({
        items,
        catName: cat?.cat_name || '猫咪',
        loading: false,
      });

      // 异步缓存图片到本地
      this.cacheRecordPhotos(items);
    } else {
      this.setData({
        error: res.message || '加载失败',
        loading: false,
      });
    }
  },

  /** 缓存记录中的照片到本地 */
  async cacheRecordPhotos(records: IRecord[]) {
    const cloudIDs = records
      .map((r) => r.photo)
      .filter((photo) => photo && photo.startsWith('cloud://'));

    if (cloudIDs.length === 0) return;

    const cachedUrls = await getCachedImageUrls(cloudIDs);

    // 构建 cloudID → cachedURL 映射
    const urlMap: Record<string, string> = {};
    for (let i = 0; i < cloudIDs.length; i++) {
      if (cachedUrls[i]) {
        urlMap[cloudIDs[i]] = cachedUrls[i];
      }
    }

    // 更新 items 中的 photo 字段
    const updatedItems = records.map((item) => ({
      ...item,
      photo: urlMap[item.photo] || item.photo,
    }));

    this.setData({ items: updatedItems });
  },

  formatDate(date: Date | string): string {
    return formatDate(date, 'YYYY-MM-DD HH:mm');
  },

  onShareAppMessage() {
    const { catId, type } = this.data;
    const title = type === 'note' ? '便利贴' : '发现记录';
    return { title, path: `/pages/cats/records/records?catId=${catId}&type=${type}` };
  },
});
