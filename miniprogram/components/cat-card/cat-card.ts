/**
 * cat-card — 猫咪卡片组件
 *
 * 用于首页推荐、猫咪列表等场景。
 * 展示猫咪头像、名字、毛色、出没地点、最近发现时间。
 */

import { getRelativeTime } from '../../utils/util';
import { getCachedImageUrl } from '../../utils/imageCache';

Component({
  properties: {
    /** 猫咪数据 */
    cat: {
      type: Object,
      value: {} as ICat,
    },
    /** 是否显示最近发现时间 */
    showRecentTime: {
      type: Boolean,
      value: true,
    },
    /** 是否显示地点 */
    showLocation: {
      type: Boolean,
      value: true,
    },
    /** 卡片模式：'default' | 'compact' */
    mode: {
      type: String,
      value: 'default',
    },
  },

  data: {
    relativeTime: '',
    ageLabel: '',
    cachedAvatar: '', // 缓存后的头像本地路径
  },

  observers: {
    'cat.createTime'(val: Date) {
      if (val) {
        this.setData({
          relativeTime: getRelativeTime(val),
        });
      }
    },
    'cat.age'(val: CatAge) {
      const AGE_MAP: Record<string, string> = {
        kitten: '幼猫',
        adult: '成年猫',
        elderly: '老年猫',
      };
      this.setData({
        ageLabel: AGE_MAP[val] || '',
      });
    },
    'cat.avatar'(val: string) {
      if (val) {
        this.loadCachedAvatar(val);
      }
    },
  },

  lifetimes: {
    attached() {
      const avatar = this.properties.cat?.avatar;
      if (avatar) {
        this.loadCachedAvatar(avatar);
      }
    },
  },

  methods: {
    /** 加载缓存的头像 */
    async loadCachedAvatar(cloudFileID: string) {
      const cached = await getCachedImageUrl(cloudFileID);
      if (cached) {
        this.setData({ cachedAvatar: cached });
      }
    },

    /** 点击卡片跳转到猫咪详情 */
    onTapCard() {
      const { cat } = this.properties;
      if (cat && cat._id) {
        wx.navigateTo({
          url: `/pages/cats/detail/detail?catId=${cat._id}`,
        });
      }
    },

    /** 预览猫咪头像 */
    onPreviewAvatar() {
      const { cachedAvatar } = this.data;
      const { cat } = this.properties;
      if (cachedAvatar) {
        wx.previewImage({
          urls: [cachedAvatar],
          current: cachedAvatar,
        });
      } else if (cat && cat.avatar) {
        wx.previewImage({
          urls: [cat.avatar],
          current: cat.avatar,
        });
      }
    },
  },
});
