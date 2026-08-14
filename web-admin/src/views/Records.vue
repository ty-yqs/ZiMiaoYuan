<template>
  <div>
    <el-card shadow="never" class="toolbar">
      <div class="toolbar-inner">
        <span class="title">记录管理（{{ total }}）</span>
        <el-button @click="load">刷新</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-tabs v-model="status" @tab-change="onStatusChange">
        <el-tab-pane label="待审核" name="pending" />
        <el-tab-pane label="已通过" name="approved" />
        <el-tab-pane label="已拒绝" name="rejected" />
        <el-tab-pane label="全部" name="all" />
      </el-tabs>

      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column label="猫咪" min-width="110">
          <template #default="{ row }">{{ row.catName || '未知猫咪' }}</template>
        </el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{ row }">{{ RECORD_TYPE_LABEL[row.type] || '记录' }}</template>
        </el-table-column>
        <el-table-column label="描述" min-width="180">
          <template #default="{ row }">{{ row.description || '-' }}</template>
        </el-table-column>
        <el-table-column label="照片" width="150">
          <template #default="{ row }">
            <div v-if="row.photos && row.photos.length" class="thumb-row">
              <CloudImage
                v-for="p in row.photos.slice(0, 3)"
                :key="p"
                :file-id="p"
                :preview-file-ids="row.photos"
                width="36px"
                height="36px"
              />
              <span v-if="row.photos.length > 3" class="more">+{{ row.photos.length - 3 }}</span>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="提交者" width="110">
          <template #default="{ row }">{{ row.nickname || '未知' }}</template>
        </el-table-column>
        <el-table-column label="时间" width="150">
          <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusInfo(row.status).type" size="small">
              {{ statusInfo(row.status).text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="240" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button size="small" type="success" @click="onApprove(row)">通过</el-button>
              <el-button size="small" type="warning" @click="onReject(row)">拒绝</el-button>
            </template>
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pagination"
        layout="prev, pager, next, total"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        @current-change="onPageChange"
      />
    </el-card>

    <!-- 编辑对话框 -->
    <el-dialog v-model="editVisible" title="编辑记录" width="560px">
      <div class="edit-block">
        <div class="edit-label">描述</div>
        <el-input v-model="editDescription" type="textarea" :rows="3" placeholder="记录描述" />
      </div>

      <div class="edit-block">
        <div class="edit-label">照片（可删除或新增）</div>
        <div class="photo-grid">
          <div v-for="(p, i) in editPhotos" :key="p" class="photo-box">
            <CloudImage :file-id="p" width="80px" height="80px" />
            <div class="photo-remove" @click="removePhoto(i)">×</div>
          </div>
          <div class="photo-add" @click="triggerUpload">
            <span class="add-plus">+</span>
            <span class="add-text">添加</span>
          </div>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          multiple
          class="hidden-input"
          @change="onFileChange"
        />
      </div>

      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 拒绝对话框 -->
    <el-dialog v-model="rejectVisible" title="拒绝原因" width="420px">
      <el-input v-model="rejectReason" type="textarea" :rows="3" placeholder="请填写拒绝原因" />
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="danger" :loading="submitting" @click="confirmReject">确认拒绝</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import CloudImage from '../components/CloudImage.vue';
import { callFunction, uploadImage } from '../api';
import { RECORD_TYPE_LABEL, formatTime } from '../labels';

const list = ref<any[]>([]);
const loading = ref(false);
const status = ref('pending');
const page = ref(1);
const pageSize = 20;
const total = ref(0);

const submitting = ref(false);
const saving = ref(false);

const STATUS_MAP: Record<string, { text: string; type: any }> = {
  pending: { text: '待审核', type: 'warning' },
  approved: { text: '已通过', type: 'success' },
  rejected: { text: '已拒绝', type: 'danger' },
};

function statusInfo(s: string) {
  return STATUS_MAP[s] || { text: s || '未知', type: 'info' };
}

async function load() {
  loading.value = true;
  try {
    const res = await callFunction('getRecords', {
      status: status.value,
      page: page.value,
      pageSize,
    });
    if (res.code === 0) {
      list.value = res.data?.records || [];
      total.value = res.data?.total || 0;
    } else {
      ElMessage.error(res.message || '加载失败');
    }
  } catch (err: any) {
    console.error('[Records] 加载失败:', err);
    ElMessage.error(err?.message || '网络异常');
  } finally {
    loading.value = false;
  }
}

function onStatusChange() {
  page.value = 1;
  load();
}

function onPageChange(p: number) {
  page.value = p;
  load();
}

// ==================== 审核 ====================

async function onApprove(r: any) {
  try {
    await ElMessageBox.confirm('确定通过这条记录吗？', '审核通过', { type: 'warning' });
  } catch {
    return;
  }
  const res = await callFunction('reviewRecord', { recordId: r._id, action: 'approve' });
  if (res.code === 0) {
    ElMessage.success('已通过');
    load();
  } else {
    ElMessage.error(res.message || '操作失败');
  }
}

const rejectVisible = ref(false);
const rejectReason = ref('');
let rejectTarget: any = null;

function onReject(r: any) {
  rejectTarget = r;
  rejectReason.value = '';
  rejectVisible.value = true;
}

async function confirmReject() {
  if (!rejectReason.value.trim()) {
    ElMessage.warning('请填写拒绝原因');
    return;
  }
  if (submitting.value) return;
  submitting.value = true;
  try {
    const res = await callFunction('reviewRecord', {
      recordId: rejectTarget._id,
      action: 'reject',
      reason: rejectReason.value.trim(),
    });
    if (res.code === 0) {
      ElMessage.success('已拒绝');
      rejectVisible.value = false;
      load();
    } else {
      ElMessage.error(res.message || '操作失败');
    }
  } finally {
    submitting.value = false;
  }
}

// ==================== 编辑 ====================

const editVisible = ref(false);
const editDescription = ref('');
const editPhotos = ref<string[]>([]);
const fileInput = ref<HTMLInputElement>();
let editTarget: any = null;

function openEdit(r: any) {
  editTarget = r;
  editDescription.value = r.description || '';
  editPhotos.value = [...(r.photos || [])];
  editVisible.value = true;
}

function removePhoto(i: number) {
  editPhotos.value.splice(i, 1);
}

function triggerUpload() {
  fileInput.value?.click();
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  if (files.length === 0) return;

  for (const f of files) {
    try {
      const fileId = await uploadImage(f);
      if (fileId) editPhotos.value.push(fileId);
    } catch (err: any) {
      ElMessage.error('上传失败：' + (err?.message || '未知错误'));
    }
  }
  input.value = ''; // 允许再次选择同一文件
}

async function saveEdit() {
  if (saving.value) return;
  saving.value = true;
  try {
    const res = await callFunction('reviewRecord', {
      recordId: editTarget._id,
      action: 'edit',
      description: editDescription.value,
      photos: editPhotos.value,
    });
    if (res.code === 0) {
      ElMessage.success('已保存');
      editVisible.value = false;
      load();
    } else {
      ElMessage.error(res.message || '操作失败');
    }
  } finally {
    saving.value = false;
  }
}

// ==================== 删除 ====================

async function onDelete(r: any) {
  try {
    await ElMessageBox.confirm(
      '确定删除这条记录吗？其图片将从云存储一并删除，且不可恢复。',
      '删除确认',
      { type: 'error', confirmButtonText: '删除', confirmButtonClass: 'el-button--danger' }
    );
  } catch {
    return;
  }
  const res = await callFunction('reviewRecord', { recordId: r._id, action: 'delete' });
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
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
.thumb-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.more {
  color: #999;
  font-size: 12px;
  margin-left: 2px;
}
.edit-block {
  margin-bottom: 16px;
}
.edit-label {
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
}
.photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.photo-box {
  position: relative;
}
.photo-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #f56c6c;
  color: #fff;
  font-size: 14px;
  line-height: 18px;
  text-align: center;
  cursor: pointer;
}
.photo-add {
  width: 80px;
  height: 80px;
  border: 1px dashed #c0c4cc;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #999;
}
.add-plus {
  font-size: 24px;
  line-height: 1;
}
.add-text {
  font-size: 12px;
}
.hidden-input {
  display: none;
}
</style>
