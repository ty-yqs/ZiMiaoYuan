<template>
  <div>
    <el-card shadow="never" class="toolbar">
      <div class="toolbar-inner">
        <span class="title">编辑提案审核</span>
        <el-button @click="load">刷新</el-button>
      </div>
    </el-card>

    <div v-loading="loading">
      <el-empty v-if="!loading && list.length === 0" description="暂无待审核提案" />
      <el-card v-for="p in list" :key="p._id" shadow="hover" class="item-card">
        <div class="item-title">
          猫咪：{{ p.catName || '未知猫咪' }}
          <el-tag size="small" type="info">提案人：{{ p.nickname || '未知' }}</el-tag>
        </div>

        <div class="changes">
          <div v-for="(value, key) in p.proposedChanges" :key="key" class="change-row">
            <span class="field">{{ FIELD_LABEL[key] || key }}：</span>
            <span class="value">{{ formatFieldValue(key, value) }}</span>
          </div>
          <div v-if="relationshipText(p)" class="change-row rel">
            {{ relationshipText(p) }}
          </div>
        </div>

        <div class="footer-row">
          <span class="submitter">{{ formatTime(p.createTime) }}</span>
          <div>
            <el-button type="success" size="small" @click="onApprove(p)">通过</el-button>
            <el-button type="danger" size="small" @click="onReject(p)">拒绝</el-button>
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
import { callFunction } from '../api';
import { AGE_LABEL, GENDER_LABEL, REL_TYPE_LABEL, formatTime } from '../labels';

const FIELD_LABEL: Record<string, string> = {
  cat_name: '名字',
  color: '毛色',
  gender: '性别',
  age: '年龄',
  description: '描述',
  health: '健康状态',
};

const list = ref<any[]>([]);
const loading = ref(false);
const submitting = ref(false);

const rejectVisible = ref(false);
const rejectReason = ref('');
let rejectTarget: any = null;

function formatFieldValue(key: string, value: any): string {
  if (key === 'gender') return GENDER_LABEL[value] || String(value ?? '');
  if (key === 'age') return AGE_LABEL[value] || String(value ?? '');
  if (key === 'health' && typeof value === 'object') {
    const parts = [value.sterilized ? '已绝育' : '未绝育', value.vaccinated ? '已疫苗' : '未疫苗'];
    return parts.join(' / ');
  }
  return String(value ?? '');
}

function relationshipText(p: any): string {
  const changes = p.proposedRelationshipChanges;
  if (!changes) return '';
  const parts: string[] = [];
  if (changes.add?.length) {
    const types = changes.add.map((a: any) => REL_TYPE_LABEL[a.type] || a.type);
    parts.push(`新增关系：${types.join('、')}`);
  }
  if (changes.remove?.length) {
    parts.push(`删除关系 ${changes.remove.length} 条`);
  }
  return parts.join('；');
}

async function load() {
  loading.value = true;
  try {
    const res = await callFunction('getPendingEdits');
    if (res.code === 0) {
      list.value = res.data || [];
    } else {
      ElMessage.error(res.message || '加载失败');
    }
  } catch (err) {
    console.error('[ReviewEdits] 加载失败:', err);
    ElMessage.error('网络异常');
  } finally {
    loading.value = false;
  }
}

async function onApprove(p: any) {
  try {
    await ElMessageBox.confirm(`确定通过「${p.catName || '未知猫咪'}」的编辑提案吗？`, '审核通过', {
      type: 'warning',
    });
  } catch {
    return;
  }
  const res = await callFunction('adminUpdateCat', {
    action: 'reviewEdit',
    proposalId: p._id,
    decision: 'approve',
  });
  if (res.code === 0) {
    ElMessage.success('已通过');
    load();
  } else {
    ElMessage.error(res.message || '操作失败');
  }
}

function onReject(p: any) {
  rejectTarget = p;
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
    const res = await callFunction('adminUpdateCat', {
      action: 'reviewEdit',
      proposalId: rejectTarget._id,
      decision: 'reject',
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
.item-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.changes {
  background: #fafafa;
  border-radius: 6px;
  padding: 12px;
}
.change-row {
  margin-bottom: 6px;
  font-size: 13px;
}
.field {
  color: #999;
}
.value {
  color: #333;
}
.rel {
  color: #7ec8a8;
}
.footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}
.submitter {
  color: #999;
  font-size: 12px;
}
</style>
