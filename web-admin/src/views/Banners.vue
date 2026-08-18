<template>
  <div>
    <el-card shadow="never" class="toolbar">
      <div class="toolbar-inner">
        <span class="title">首页头图（{{ list.length }}）</span>
        <el-button @click="load">刷新</el-button>
      </div>
    </el-card>

    <el-card shadow="never" class="add-card">
      <div class="add-title">新增头图</div>
      <div class="add-form">
        <div class="upload-box" @click="triggerUpload">
          <CloudImage v-if="form.image" :file-id="form.image" width="120px" height="68px" />
          <div v-else class="upload-placeholder">+ 上传图片</div>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="hidden-input"
          @change="onFileChange"
        />
        <el-input-number
          v-model="form.sort"
          :min="0"
          :step="1"
          :controls="false"
          placeholder="排序"
          style="width: 120px"
        />
        <el-select
          v-model="form.articleId"
          clearable
          placeholder="关联文章（可选）"
          style="width: 220px"
          @change="onFormArticleChange"
        >
          <el-option v-for="a in articles" :key="a._id" :label="a.title" :value="a._id" />
        </el-select>
        <el-input
          v-model="form.link"
          placeholder="跳转路径（可选）：小程序路径或公众号文章链接"
          style="width: 280px"
        />
        <el-button type="primary" :loading="saving" @click="onAdd">添加</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column label="预览" width="170">
          <template #default="{ row }">
            <CloudImage :file-id="row.image" width="120px" height="68px" />
          </template>
        </el-table-column>
        <el-table-column label="排序" prop="sort" width="80" />
        <el-table-column label="跳转链接" min-width="200">
          <template #default="{ row }">{{ row.link || '-' }}</template>
        </el-table-column>
        <el-table-column label="关联文章" min-width="140">
          <template #default="{ row }">{{ articleTitle(row.articleId) }}</template>
        </el-table-column>
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" @change="(val) => onToggle(row, val)" />
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="onEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 编辑对话框 -->
    <el-dialog v-model="editVisible" title="编辑头图" width="460px">
      <el-form label-width="80px">
        <el-form-item label="图片">
          <div class="upload-box" @click="triggerEditUpload">
            <CloudImage v-if="editForm.image" :file-id="editForm.image" width="180px" height="100px" />
            <div v-else class="upload-placeholder">+ 上传图片</div>
          </div>
          <input
            ref="editFileInput"
            type="file"
            accept="image/*"
            class="hidden-input"
            @change="onEditFileChange"
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number
            v-model="editForm.sort"
            :min="0"
            :step="1"
            :controls="false"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="关联文章">
          <el-select
            v-model="editForm.articleId"
            clearable
            placeholder="可选，选文章自动填充跳转链接"
            style="width: 100%"
            @change="onEditArticleChange"
          >
            <el-option v-for="a in articles" :key="a._id" :label="a.title" :value="a._id" />
          </el-select>
        </el-form-item>
        <el-form-item label="跳转链接">
          <el-input v-model="editForm.link" placeholder="可选：/pages/xxx 路径或公众号文章链接" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="editForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSaveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { callFunction, uploadImage } from '../api';
import { formatTime } from '../labels';
import CloudImage from '../components/CloudImage.vue';

const list = ref<any[]>([]);
const loading = ref(false);
const saving = ref(false);

const fileInput = ref<HTMLInputElement>();
const editFileInput = ref<HTMLInputElement>();

const form = reactive({
  image: '',
  sort: 0,
  link: '',
  articleId: '',
});

// 文章下拉（用于「关联文章」）
const articles = ref<any[]>([]);

async function loadArticles() {
  try {
    const res = await callFunction('manageArticles', { action: 'list' });
    if (res.code === 0) {
      articles.value = res.data || [];
    }
  } catch (err: any) {
    console.error('[Banners] 加载文章失败:', err);
  }
}

function articlePath(id: string): string {
  return id ? `/pages/article/article?id=${id}` : '';
}

function articleTitle(id: string): string {
  if (!id) return '-';
  const a = articles.value.find((x) => x._id === id);
  return a?.title || '-';
}

function onFormArticleChange(id: string) {
  form.link = articlePath(id);
}

function onEditArticleChange(id: string) {
  editForm.link = articlePath(id);
}

async function load() {
  loading.value = true;
  try {
    const res = await callFunction('manageBanners', { action: 'list' });
    if (res.code === 0) {
      list.value = res.data || [];
    } else {
      ElMessage.error(res.message || '加载失败');
    }
  } catch (err: any) {
    console.error('[Banners] 加载失败:', err);
    ElMessage.error(err?.message || '网络异常');
  } finally {
    loading.value = false;
  }
}

function triggerUpload() {
  fileInput.value?.click();
}

function triggerEditUpload() {
  editFileInput.value?.click();
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  if (files.length === 0) return;
  try {
    const fileId = await uploadImage(files[0]);
    if (fileId) form.image = fileId;
  } catch (err: any) {
    ElMessage.error('上传失败：' + (err?.message || '未知错误'));
  }
  input.value = '';
}

async function onEditFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  if (files.length === 0) return;
  try {
    const fileId = await uploadImage(files[0]);
    if (fileId) editForm.image = fileId;
  } catch (err: any) {
    ElMessage.error('上传失败：' + (err?.message || '未知错误'));
  }
  input.value = '';
}

async function onAdd() {
  if (!form.image) {
    ElMessage.warning('请上传头图');
    return;
  }
  saving.value = true;
  try {
    const res = await callFunction('manageBanners', {
      action: 'add',
      image: form.image,
      sort: form.sort,
      link: form.link.trim(),
      articleId: form.articleId,
    });
    if (res.code === 0) {
      ElMessage.success(res.message || '已添加');
      form.image = '';
      form.sort = 0;
      form.link = '';
      form.articleId = '';
      load();
    } else {
      ElMessage.error(res.message || '添加失败');
    }
  } catch (err: any) {
    console.error('[Banners] 添加失败:', err);
    ElMessage.error(err?.message || '网络异常');
  } finally {
    saving.value = false;
  }
}

const editVisible = ref(false);
const editId = ref('');
const editForm = reactive({
  image: '',
  sort: 0,
  link: '',
  articleId: '',
  enabled: true,
});

function onEdit(row: any) {
  editId.value = row._id;
  editForm.image = row.image || '';
  editForm.sort = Number(row.sort) || 0;
  editForm.link = row.link || '';
  editForm.articleId = row.articleId || '';
  editForm.enabled = row.enabled !== false;
  editVisible.value = true;
}

async function onSaveEdit() {
  if (!editForm.image) {
    ElMessage.warning('请上传头图');
    return;
  }
  saving.value = true;
  try {
    const res = await callFunction('manageBanners', {
      action: 'edit',
      bannerId: editId.value,
      image: editForm.image,
      sort: editForm.sort,
      link: editForm.link.trim(),
      articleId: editForm.articleId,
      enabled: editForm.enabled,
    });
    if (res.code === 0) {
      ElMessage.success(res.message || '已更新');
      editVisible.value = false;
      load();
    } else {
      ElMessage.error(res.message || '保存失败');
    }
  } catch (err: any) {
    console.error('[Banners] 保存失败:', err);
    ElMessage.error(err?.message || '网络异常');
  } finally {
    saving.value = false;
  }
}

async function onToggle(row: any, val: boolean) {
  const res = await callFunction('manageBanners', {
    action: 'edit',
    bannerId: row._id,
    enabled: val,
  });
  if (res.code === 0) {
    ElMessage.success(val ? '已启用' : '已禁用');
  } else {
    ElMessage.error(res.message || '更新失败');
    row.enabled = !val;
  }
}

async function onDelete(row: any) {
  try {
    await ElMessageBox.confirm('确定删除该头图吗？', '删除确认', { type: 'warning' });
  } catch {
    return;
  }
  const res = await callFunction('manageBanners', { action: 'delete', bannerId: row._id });
  if (res.code === 0) {
    ElMessage.success('已删除');
    load();
  } else {
    ElMessage.error(res.message || '删除失败');
  }
}

load();
loadArticles();
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
.add-card {
  margin-bottom: 16px;
}
.add-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}
.add-form {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.upload-box {
  width: 120px;
  height: 68px;
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
</style>
