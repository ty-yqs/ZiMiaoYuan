<template>
  <div>
    <el-card shadow="never" class="toolbar">
      <div class="toolbar-inner">
        <span class="title">记录审核</span>
        <el-button @click="load">刷新</el-button>
      </div>
    </el-card>

    <div v-loading="loading">
      <el-empty v-if="!loading && list.length === 0" description="暂无待审核记录" />
      <el-card v-for="r in list" :key="r._id" shadow="hover" class="item-card">
        <div class="item-row">
          <CloudImage
            v-if="recordPhoto(r)"
            :file-id="recordPhoto(r)"
            :preview-file-ids="recordPhotos(r)"
            width="100px"
            height="100px"
          />

          <div class="item-info">
            <div class="item-title">
              {{ r.catName || '未知猫咪' }}
              <el-tag size="small">{{ RECORD_TYPE_LABEL[r.type] || '记录' }}</el-tag>
              <el-tag size="small" type="info">发布者：{{ r.nickname || '未知' }}</el-tag>
            </div>
            <div v-if="r.description" class="desc">{{ r.description }}</div>
            <div class="submitter">{{ formatTime(r.createTime) }}</div>
          </div>

          <div class="actions">
            <el-button type="success" size="small" @click="onApprove(r)">通过</el-button>
            <el-button type="danger" size="small" @click="onReject(r)">拒绝</el-button>
          </div>
        </div>
      </el-card>
    </div>

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
import { callFunction } from '../api';
import { RECORD_TYPE_LABEL, formatTime } from '../labels';

const list = ref<any[]>([]);
const loading = ref(false);
const submitting = ref(false);

const rejectVisible = ref(false);
const rejectReason = ref('');
let rejectTarget: any = null;

function recordPhotos(r: any): string[] {
  return r.photos || (r.photo ? [r.photo] : []);
}

function recordPhoto(r: any): string {
  return recordPhotos(r)[0] || '';
}

async function load() {
  loading.value = true;
  try {
    const res = await callFunction('getPendingRecords');
    if (res.code === 0) {
      list.value = res.data || [];
    } else {
      ElMessage.error(res.message || '加载失败');
    }
  } catch (err) {
    console.error('[ReviewRecords] 加载失败:', err);
    ElMessage.error('网络异常');
  } finally {
    loading.value = false;
  }
}

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
.item-card {
  margin-bottom: 12px;
}
.item-row {
  display: flex;
  gap: 16px;
}
.item-info {
  flex: 1;
  min-width: 0;
}
.item-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
}
.desc {
  color: #666;
  font-size: 13px;
  margin: 8px 0;
  white-space: pre-wrap;
}
.submitter {
  color: #999;
  font-size: 12px;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}
</style>
