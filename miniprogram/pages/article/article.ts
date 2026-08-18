/**
 * 文章详情页
 *
 * 仅通过首页头图跳转进入（不出现在 tabBar），
 * 展示文章标题、封面图与富文本正文。
 */
import { apiGetArticle } from '../../utils/api';
import { getCachedImageUrl, resolveHtmlImages } from '../../utils/imageCache';

/** 让富文本里的图片自适应宽度，避免超出屏幕 */
function normalizeArticleHtml(html: string): string {
  return html.replace(/<img([^>]*)>/gi, (_whole, attrs: string) => {
    const style = 'max-width:100%;height:auto;display:block;';
    if (/style\s*=\s*["']/i.test(attrs)) {
      return `<img${attrs.replace(/(style\s*=\s*["'])/i, `$1${style}`)}>`;
    }
    return `<img${attrs} style="${style}">`;
  });
}

Page({
  data: {
    articleId: '',
    title: '',
    cover: '',   // 封面本地路径
    content: '', // 已解析 cloud:// 图片的富文本 HTML
    loading: true,
    error: '',
  },

  onLoad(options: Record<string, string>) {
    const { id } = options;
    if (id) {
      this.setData({ articleId: id });
      this.loadArticle();
    } else {
      this.setData({ loading: false, error: '文章不存在' });
    }
  },

  async loadArticle() {
    this.setData({ loading: true, error: '' });

    const res = await apiGetArticle(this.data.articleId);
    if (res.code !== 0 || !res.data) {
      this.setData({ loading: false, error: res.message || '文章不存在' });
      return;
    }

    const article = res.data;
    const [cover, content] = await Promise.all([
      article.cover ? getCachedImageUrl(article.cover) : Promise.resolve(''),
      resolveHtmlImages(article.content || ''),
    ]);

    if (article.title) {
      wx.setNavigationBarTitle({ title: article.title });
    }

    this.setData({
      title: article.title || '',
      cover: cover || '',
      content: normalizeArticleHtml(content),
      loading: false,
    });
  },

  onShareAppMessage() {
    const path = this.data.articleId
      ? `/pages/article/article?id=${this.data.articleId}`
      : '/pages/index/index';
    return { title: this.data.title || '紫喵园', path };
  },
});
