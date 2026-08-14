<template>
  <div>
    <el-card shadow="never" class="toolbar">
      <div class="toolbar-inner">
        <span class="title">待审核猫咪</span>
        <el-button @click="load">刷新</el-button>
      </div>
    </el-card>

    <div v-loading="loading">
      <el-empty v-if="!loading && list.length === 0" description="暂无待审核猫咪" />
      <el-card v-for="cat in list" :key="cat._id" shadow="hover" class="item-card">
        <div class="item-row">
          <CloudImage :file-id="cat.avatar" width="100px" height="100px" />

          <div class="item-info">
            <div class="item-title">
              {{ cat.cat_name || '未命名猫咪' }}
              <el-tag v-if="cat.photos && cat.photos.length > 1" size="small" type="info">
                共 {{ cat.photos.length }} 张照片
              </el-tag>
            </div>
            <div class="meta">
              <el-tag size="small">{{ cat.color || '未知毛色' }}</el-tag>
              <el-tag size="small" type="info">{{ GENDER_LABEL[cat.gender] || '未知' }}</el-tag>
              <el-tag size="small" type="info">{{ AGE_LABEL[cat.age] || '未知' }}</el-tag>
              <el-tag v-if="cat.health?.sterilized" size="small" type="success">已绝育</el-tag>
              <el-tag v-if="cat.health?.vaccinated" size="small" type="success">已疫苗</el-tag>
            </div>
            <div v-if="cat.description" class="desc">{{ cat.description }}</div>
            <div class="submitter">
              提交者：{{ cat.submitterNickname || '未知' }} · {{ formatTime(cat.createTime) }}
            </div>
          </div>

          <div class="actions">
            <el-button type="success" size="small" @click="onApprove(cat)">通过</el-button>
            <el-button type="danger" size="small" @click="onReject(cat)">拒绝</el-button>
          </div>
        </div>
      </el-card>
    </div>

    <el-dialog v-model="rejectVisible" title="拒绝原因" width="420px">
      <el-input
        v-model="rejectReason"
        type="textarea"
        :rows="3"
        placeholder="请填写拒绝原因"
      />
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
import { AGE_LABEL, GENDER_LABEL, formatTime } from '../labels';

const list = ref<any[]>([]);
const loading = ref(false);
const submitting = ref(false);

const rejectVisible = ref(false);
const rejectReason = ref('');
let rejectTarget: any = null;

async function load() {
  loading.value = true;
  try {
    const res = await callFunction('getCats', {
      status: 'pending',
      pageSize: 50,
      resolveUser: true,
    });
    if (res.code === 0) {
      list.value = res.data?.cats || [];
    } else {
      ElMessage.error(res.message || '加载失败');
    }
  } catch (err) {
    console.error('[ReviewCats] 加载失败:', err);
    ElMessage.error('网络异常');
  } finally {
    loading.value = false;
  }
}

async function onApprove(cat: any) {
  const name = cat.cat_name || '未命名猫咪';
  try {
    await ElMessageBox.confirm(`确定通过「${name}」的审核吗？`, '审核通过', { type: 'warning' });
  } catch {
    return;
  }
  const res = await callFunction('adminUpdateCat', { catId: cat._id, action: 'approve' });
  if (res.code === 0) {
    ElMessage.success('已通过');
    load();
  } else {
    ElMessage.error(res.message || '操作失败');
  }
}

function onReject(cat: any) {
  rejectTarget = cat;
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
      catId: rejectTarget._id,
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
  font-size: 16px;
  font-weight: 600;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
}
.meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: 8px 0;
}
.desc {
  color: #666;
  font-size: 13px;
  margin: 4px 0;
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
