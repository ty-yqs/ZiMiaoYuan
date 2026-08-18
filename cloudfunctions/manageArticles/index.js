/**
 * manageArticles 云函数 — 管理员管理文章
 *
 * 支持：
 * - list:   列出全部文章，按创建时间倒序
 * - add:    新增文章（title / cover / content）
 * - edit:   编辑文章（title / cover / content）
 * - delete: 删除文章
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS, success, fail, getCollection, requireAdmin,
} = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const ACTIONS = ['list', 'add', 'edit', 'delete'];

exports.main = async (event) => {
  const admin = await requireAdmin(event);
  if (!admin) {
    return fail('权限不足，仅管理员可操作', -403);
  }

  const { action } = event;

  if (!ACTIONS.includes(action)) {
    return fail('无效的操作类型，支持：' + ACTIONS.join(' / '));
  }

  try {
    const articlesColl = getCollection(COLLECTIONS.ARTICLES);

    if (action === 'list') {
      const res = await articlesColl
        .orderBy('createTime', 'desc')
        .limit(100)
        .get();
      return success(res.data);
    }

    if (action === 'add') {
      const { title, cover = '', content } = event;

      const trimmedTitle = String(title || '').trim();
      if (!trimmedTitle) {
        return fail('请填写文章标题');
      }
      if (!content || !String(content).trim()) {
        return fail('请填写文章正文');
      }

      const data = {
        title: trimmedTitle,
        cover: String(cover || '').trim(),
        content: String(content),
        createTime: new Date(),
      };

      const addRes = await articlesColl.add({ data });
      data._id = addRes._id;

      console.log('[manageArticles] 新增文章:', addRes._id, trimmedTitle);
      return success(data, '文章已添加');
    }

    if (action === 'edit') {
      const { articleId, title, cover, content } = event;
      if (!articleId) {
        return fail('缺少文章ID');
      }

      const articleRes = await articlesColl.doc(articleId).get();
      if (!articleRes.data || !articleRes.data._id) {
        return fail('文章不存在');
      }

      const updateData = {};

      if (title !== undefined && title !== null) {
        const trimmedTitle = String(title).trim();
        if (!trimmedTitle) {
          return fail('请填写文章标题');
        }
        updateData.title = trimmedTitle;
      }

      if (cover !== undefined && cover !== null) {
        updateData.cover = String(cover).trim();
      }

      if (content !== undefined && content !== null) {
        if (!String(content).trim()) {
          return fail('请填写文章正文');
        }
        updateData.content = String(content);
      }

      if (Object.keys(updateData).length === 0) {
        return fail('没有可更新的内容');
      }

      updateData.updateTime = new Date();
      await articlesColl.doc(articleId).update({ data: updateData });
      console.log('[manageArticles] 文章已编辑:', articleId, Object.keys(updateData));
      return success(null, '文章已更新');
    }

    if (action === 'delete') {
      const { articleId } = event;
      if (!articleId) {
        return fail('缺少文章ID');
      }
      await articlesColl.doc(articleId).remove();
      console.log('[manageArticles] 已删除文章:', articleId);
      return success(null, '已删除');
    }

  } catch (err) {
    console.error('[manageArticles] 异常:', err);
    return fail('操作失败：' + err.message);
  }
};
