<template>
  <div>
    <el-card shadow="never" class="toolbar">
      <div class="toolbar-inner">
        <span class="title">文章管理（{{ list.length }}）</span>
        <div>
          <el-button @click="load">刷新</el-button>
          <el-button type="primary" @click="onAdd">新增文章</el-button>
        </div>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column label="封面" width="120">
          <template #default="{ row }">
            <CloudImage v-if="row.cover" :file-id="row.cover" width="80px" height="50px" />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="标题" min-width="240">
          <template #default="{ row }">{{ row.title || '-' }}</template>
        </el-table-column>
        <el-table-column label="更新时间" width="170">
          <template #default="{ row }">{{ formatTime(row.updateTime || row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="onEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editId ? '编辑文章' : '新增文章'"
      width="760px"
      top="4vh"
    >
      <div v-loading="dialogLoading" class="article-form">
        <el-form label-width="60px">
          <el-form-item label="标题">
            <el-input v-model="title" placeholder="文章标题" />
          </el-form-item>
          <el-form-item label="封面">
            <div class="cover-row">
              <div class="upload-box" @click="triggerCoverUpload">
                <CloudImage v-if="cover" :file-id="cover" width="160px" height="90px" />
                <div v-else class="upload-placeholder">+ 上传封面</div>
              </div>
              <el-button v-if="cover" text type="danger" @click="cover = ''">移除封面</el-button>
            </div>
            <input
              ref="coverInput"
              type="file"
              accept="image/*"
              class="hidden-input"
              @change="onCoverChange"
            />
          </el-form-item>
          <el-form-item label="正文">
            <div class="editor-wrapper">
              <Toolbar
                class="editor-toolbar"
                :editor="editorRef"
                :default-config="toolbarConfig"
                mode="default"
              />
              <Editor
                v-model="contentHtml"
                class="editor-body"
                :default-config="editorConfig"
                mode="default"
                @onCreated="handleCreated"
              />
            </div>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import '@wangeditor/editor/dist/css/style.css';
import { ref, shallowRef, onBeforeUnmount } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Editor, Toolbar } from '@wangeditor/editor-for-vue';
import { callFunction, uploadImage } from '../api';
import { resolveImageUrl, resolveImageUrls } from '../imageCache';
import { formatTime } from '../labels';
import CloudImage from '../components/CloudImage.vue';

const list = ref<any[]>([]);
const loading = ref(false);
const saving = ref(false);

const dialogVisible = ref(false);
const dialogLoading = ref(false);
const editId = ref('');
const title = ref('');
const cover = ref('');
const contentHtml = ref('<p><br></p>');
const coverInput = ref<HTMLInputElement>();

// 编辑器实例
const editorRef = shallowRef();
const toolbarConfig = {};
const editorConfig: any = {
  placeholder: '请输入正文...',
  MENU_CONF: {},
};

// 临时 https 链接 → cloud:// fileID 映射（保存时把编辑器里的临时链接还原为 cloud://）
const displayToCloud = new Map<string, string>();

editorConfig.MENU_CONF['uploadImage'] = {
  async customUpload(file: File, insertFn: (url: string, alt: string, href: string) => void) {
    try {
      const fileId = await uploadImage(file);
      const url = await resolveImageUrl(fileId);
      if (url) {
        displayToCloud.set(url, fileId);
        insertFn(url, file.name, '');
      }
    } catch (err: any) {
      ElMessage.error('图片上传失败：' + (err?.message || '未知错误'));
    }
  },
};

function handleCreated(editor: any) {
  editorRef.value = editor;
}

onBeforeUnmount(() => {
  editorRef.value?.destroy();
});

async function load() {
  loading.value = true;
  try {
    const res = await callFunction('manageArticles', { action: 'list' });
    if (res.code === 0) {
      list.value = res.data || [];
    } else {
      ElMessage.error(res.message || '加载失败');
    }
  } catch (err: any) {
    console.error('[Articles] 加载失败:', err);
    ElMessage.error(err?.message || '网络异常');
  } finally {
    loading.value = false;
  }
}

function triggerCoverUpload() {
  coverInput.value?.click();
}

async function onCoverChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  if (files.length === 0) return;
  try {
    const fileId = await uploadImage(files[0]);
    if (fileId) cover.value = fileId;
  } catch (err: any) {
    ElMessage.error('封面上传失败：' + (err?.message || '未知错误'));
  }
  input.value = '';
}

function onAdd() {
  editId.value = '';
  title.value = '';
  cover.value = '';
  contentHtml.value = '<p><br></p>';
  dialogVisible.value = true;
}

async function onEdit(row: any) {
  editId.value = row._id;
  title.value = row.title || '';
  cover.value = row.cover || '';
  dialogVisible.value = true;
  dialogLoading.value = true;
  contentHtml.value = await htmlFromCloud(row.content || '');
  dialogLoading.value = false;
}

/** 云存储 HTML → 编辑器可显示的临时链接 HTML（并记录反向映射） */
async function htmlFromCloud(html: string): Promise<string> {
  const re = /cloud:\/\/[^\s"'<>()]+/g;
  const ids = [...new Set(html.match(re) || [])];
  if (ids.length === 0) return html;
  const urls = await resolveImageUrls(ids);
  let out = html;
  ids.forEach((id, i) => {
    const url = urls[i];
    if (url && url !== id) {
      displayToCloud.set(url, id);
      out = out.split(id).join(url);
    }
  });
  return out;
}

/** 编辑器临时链接 HTML → 云存储 HTML（把 https 还原为 cloud://） */
function htmlToCloud(html: string): string {
  let out = html;
  displayToCloud.forEach((cloudId, url) => {
    out = out.split(url).join(cloudId);
  });
  return out;
}

async function onSave() {
  if (!title.value.trim()) {
    ElMessage.warning('请填写文章标题');
    return;
  }
  const html = editorRef.value?.getHtml?.() || contentHtml.value;
  const textOnly = html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();
  if (!textOnly) {
    ElMessage.warning('请填写文章正文');
    return;
  }
  saving.value = true;
  try {
    const payload: Record<string, any> = {
      title: title.value.trim(),
      cover: cover.value,
      content: htmlToCloud(html),
    };
    if (editId.value) payload.articleId = editId.value;

    const res = await callFunction(
      'manageArticles',
      editId.value ? { action: 'edit', ...payload } : { action: 'add', ...payload }
    );
    if (res.code === 0) {
      ElMessage.success(res.message || '已保存');
      dialogVisible.value = false;
      load();
    } else {
      ElMessage.error(res.message || '保存失败');
    }
  } catch (err: any) {
    console.error('[Articles] 保存失败:', err);
    ElMessage.error(err?.message || '网络异常');
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除文章「${row.title || '未命名'}」吗？`, '删除确认', {
      type: 'warning',
    });
  } catch {
    return;
  }
  const res = await callFunction('manageArticles', { action: 'delete', articleId: row._id });
  if (res.code === 0) {
    ElMessage.success('已删除');
    load();
  } else {
    ElMessage.error(res.message || '删除失败');
  }
}

load();
</script>

<style scoped>
.toolbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}
.cover-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.upload-box {
  width: 160px;
  height: 90px;
  border: 1px dashed #c0c4cc;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  flex-shrink: 0;
}
.upload-placeholder {
  color: #999;
  font-size: 13px;
}
.hidden-input {
  display: none;
}
.editor-wrapper {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  z-index: 100;
}
.editor-toolbar {
  border-bottom: 1px solid #e5e7eb;
}
.editor-body {
  height: 340px;
  overflow-y: hidden;
}
</style>
