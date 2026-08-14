<template>
  <div>
    <el-card shadow="never" class="toolbar">
      <div class="toolbar-inner">
        <span class="title">赞助管理（{{ list.length }}）</span>
        <el-button @click="load">刷新</el-button>
      </div>
    </el-card>

    <el-card shadow="never" class="add-card">
      <div class="add-title">新增赞助记录</div>
      <div class="add-form">
        <el-input v-model="form.name" placeholder="赞助者昵称" style="width: 200px" />
        <el-input-number
          v-model="form.amount"
          :min="0"
          :precision="2"
          :step="1"
          :controls="false"
          style="width: 140px"
        />
        <el-date-picker
          v-model="form.month"
          type="month"
          value-format="YYYY-MM"
          placeholder="月份"
          style="width: 140px"
        />
        <el-button type="primary" :loading="saving" @click="onAdd">添加</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column label="昵称" min-width="140">
          <template #default="{ row }">{{ row.name || '-' }}</template>
        </el-table-column>
        <el-table-column label="月份" prop="month" width="120" />
        <el-table-column label="金额" width="120">
          <template #default="{ row }">¥{{ row.amount }}</template>
        </el-table-column>
        <el-table-column label="添加时间" width="160">
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
    <el-dialog v-model="editVisible" title="编辑赞助记录" width="420px">
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="昵称">
          <el-input v-model="editForm.name" placeholder="赞助者昵称" />
        </el-form-item>
        <el-form-item label="金额">
          <el-input-number
            v-model="editForm.amount"
            :min="0"
            :precision="2"
            :step="1"
            :controls="false"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="月份">
          <el-date-picker
            v-model="editForm.month"
            type="month"
            value-format="YYYY-MM"
            placeholder="月份"
            style="width: 100%"
          />
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
import { callFunction } from '../api';
import { formatTime } from '../labels';

const list = ref<any[]>([]);
const loading = ref(false);
const saving = ref(false);

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const form = reactive({
  name: '',
  amount: 0,
  month: currentMonth(),
});

async function load() {
  loading.value = true;
  try {
    const res = await callFunction('getSupporters', {});
    if (res.code === 0) {
      list.value = res.data || [];
    } else {
      ElMessage.error(res.message || '加载失败');
    }
  } catch (err: any) {
    console.error('[Supporters] 加载失败:', err);
    ElMessage.error(err?.message || '网络异常');
  } finally {
    loading.value = false;
  }
}

async function onAdd() {
  if (!form.name.trim()) {
    ElMessage.warning('请填写赞助者昵称');
    return;
  }
  if (!form.amount || form.amount <= 0) {
    ElMessage.warning('请填写正确的赞助金额');
    return;
  }
  saving.value = true;
  try {
    const res = await callFunction('adminSupporter', {
      action: 'add',
      name: form.name.trim(),
      amount: form.amount,
      month: form.month,
    });
    if (res.code === 0) {
      ElMessage.success(res.message || '已添加');
      form.name = '';
      form.amount = 0;
      form.month = currentMonth();
      load();
    } else {
      ElMessage.error(res.message || '添加失败');
    }
  } catch (err: any) {
    console.error('[Supporters] 添加失败:', err);
    ElMessage.error(err?.message || '网络异常');
  } finally {
    saving.value = false;
  }
}

const editVisible = ref(false);
const editId = ref('');
const editForm = reactive({
  name: '',
  amount: 0,
  month: '',
});

function onEdit(row: any) {
  editId.value = row._id;
  editForm.name = row.name || '';
  editForm.amount = Number(row.amount) || 0;
  editForm.month = row.month || '';
  editVisible.value = true;
}

async function onSaveEdit() {
  if (!editForm.name.trim()) {
    ElMessage.warning('请填写赞助者昵称');
    return;
  }
  if (!editForm.amount || editForm.amount <= 0) {
    ElMessage.warning('请填写正确的赞助金额');
    return;
  }
  saving.value = true;
  try {
    const res = await callFunction('adminSupporter', {
      action: 'edit',
      supporterId: editId.value,
      name: editForm.name.trim(),
      amount: editForm.amount,
      month: editForm.month,
    });
    if (res.code === 0) {
      ElMessage.success(res.message || '已更新');
      editVisible.value = false;
      load();
    } else {
      ElMessage.error(res.message || '保存失败');
    }
  } catch (err: any) {
    console.error('[Supporters] 保存失败:', err);
    ElMessage.error(err?.message || '网络异常');
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: any) {
  try {
    await ElMessageBox.confirm(
      `确定删除「${row.name || '未命名'}」（¥${row.amount}，${row.month}）吗？`,
      '删除确认',
      { type: 'warning' }
    );
  } catch {
    return;
  }
  const res = await callFunction('adminSupporter', { action: 'delete', supporterId: row._id });
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
</style>
