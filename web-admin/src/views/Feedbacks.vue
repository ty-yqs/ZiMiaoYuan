<template>
  <div>
    <el-card shadow="never" class="toolbar">
      <div class="toolbar-inner">
        <span class="title">用户反馈（{{ total }}）</span>
        <el-button @click="load">刷新</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column label="昵称" width="140">
          <template #default="{ row }">{{ row.nickname || '未知用户' }}</template>
        </el-table-column>
        <el-table-column label="反馈内容" prop="content" min-width="300" />
        <el-table-column label="联系方式" width="160">
          <template #default="{ row }">{{ row.contact || '-' }}</template>
        </el-table-column>
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { callFunction } from '../api';
import { formatTime } from '../labels';

const list = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);

async function load() {
  loading.value = true;
  try {
    const res = await callFunction('getFeedbacks', { page: page.value, pageSize });
    if (res.code === 0) {
      list.value = res.data?.feedbacks || [];
      total.value = res.data?.total || 0;
    } else {
      ElMessage.error(res.message || '加载失败');
    }
  } catch (err) {
    console.error('[Feedbacks] 加载失败:', err);
    ElMessage.error('网络异常');
  } finally {
    loading.value = false;
  }
}

function onPageChange(p: number) {
  page.value = p;
  load();
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
</style>
