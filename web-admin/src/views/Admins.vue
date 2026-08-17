<template>
  <div>
    <el-card shadow="never" class="toolbar">
      <div class="toolbar-inner">
        <span class="title">子管理员管理（{{ list.length }}）</span>
        <el-button @click="load">刷新</el-button>
      </div>
    </el-card>

    <el-card shadow="never" class="add-card">
      <div class="add-title">新增子管理员</div>
      <div class="add-form">
        <el-input v-model="form.username" placeholder="用户名" style="width: 200px" />
        <el-input
          v-model="form.password"
          type="password"
          placeholder="密码（至少 6 位）"
          show-password
          style="width: 220px"
        />
        <el-button type="primary" :loading="saving" @click="onAdd">添加</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column label="用户名" min-width="160">
          <template #default="{ row }">
            <div class="username-cell">
              <span>{{ row.username }}</span>
              <el-tag v-if="row.username === currentUser" size="small" type="success" effect="plain">
                当前账号
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="角色" min-width="110">
          <template #default="{ row }">
            <el-tag :type="row.role === 'super' ? 'danger' : 'info'" size="small">
              {{ row.role === 'super' ? '最高管理员' : '子管理员' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="160">
          <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="最后登录" min-width="160">
          <template #default="{ row }">
            {{ row.lastLoginTime ? formatTime(row.lastLoginTime) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <div class="action-cell">
              <el-button size="small" @click="onReset(row)">重置密码</el-button>
              <el-button v-if="row.username !== currentUser" size="small" @click="onToggleRole(row)">
                {{ row.role === 'super' ? '降为子管理员' : '设为最高管理员' }}
              </el-button>
              <el-button
                v-if="row.username !== currentUser"
                size="small"
                type="danger"
                @click="onDelete(row)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 重置密码对话框 -->
    <el-dialog v-model="resetVisible" title="重置密码" width="420px">
      <el-form label-width="80px">
        <el-form-item label="账号">{{ resetForm.username }}</el-form-item>
        <el-form-item label="新密码">
          <el-input
            v-model="resetForm.password"
            type="password"
            show-password
            placeholder="至少 6 位"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSaveReset">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { callFunction } from '../api';
import { formatTime } from '../labels';
import { getUsername } from '../auth';

const list = ref<any[]>([]);
const loading = ref(false);
const saving = ref(false);
const currentUser = getUsername() || '';

const form = reactive({
  username: '',
  password: '',
});

async function load() {
  loading.value = true;
  try {
    const res = await callFunction('adminManageAdmins', { action: 'list' });
    if (res.code === 0) {
      list.value = res.data || [];
    } else {
      ElMessage.error(res.message || '加载失败');
    }
  } catch (err: any) {
    console.error('[Admins] 加载失败:', err);
    ElMessage.error(err?.message || '网络异常');
  } finally {
    loading.value = false;
  }
}

async function onAdd() {
  if (!form.username.trim()) {
    ElMessage.warning('请填写用户名');
    return;
  }
  if (!form.password || form.password.length < 6) {
    ElMessage.warning('密码至少 6 位');
    return;
  }
  saving.value = true;
  try {
    const res = await callFunction('adminManageAdmins', {
      action: 'add',
      username: form.username.trim(),
      password: form.password,
    });
    if (res.code === 0) {
      ElMessage.success(res.message || '已添加');
      form.username = '';
      form.password = '';
      load();
    } else {
      ElMessage.error(res.message || '添加失败');
    }
  } catch (err: any) {
    console.error('[Admins] 添加失败:', err);
    ElMessage.error(err?.message || '网络异常');
  } finally {
    saving.value = false;
  }
}

const resetVisible = ref(false);
const resetForm = reactive({
  id: '',
  username: '',
  password: '',
});

function onReset(row: any) {
  resetForm.id = row._id;
  resetForm.username = row.username;
  resetForm.password = '';
  resetVisible.value = true;
}

async function onSaveReset() {
  if (!resetForm.password || resetForm.password.length < 6) {
    ElMessage.warning('密码至少 6 位');
    return;
  }
  saving.value = true;
  try {
    const res = await callFunction('adminManageAdmins', {
      action: 'resetPassword',
      adminId: resetForm.id,
      password: resetForm.password,
    });
    if (res.code === 0) {
      ElMessage.success(res.message || '密码已重置');
      resetVisible.value = false;
    } else {
      ElMessage.error(res.message || '重置失败');
    }
  } catch (err: any) {
    console.error('[Admins] 重置密码失败:', err);
    ElMessage.error(err?.message || '网络异常');
  } finally {
    saving.value = false;
  }
}

async function onToggleRole(row: any) {
  const target = row.role === 'super' ? 'admin' : 'super';
  const tip = target === 'super' ? '设为最高管理员' : '降为子管理员';
  try {
    await ElMessageBox.confirm(`确定将「${row.username}」${tip}吗？`, '修改角色', {
      type: 'warning',
    });
  } catch {
    return;
  }
  const res = await callFunction('adminManageAdmins', {
    action: 'setRole',
    adminId: row._id,
    role: target,
  });
  if (res.code === 0) {
    ElMessage.success(res.message || '已更新');
    load();
  } else {
    ElMessage.error(res.message || '操作失败');
  }
}

async function onDelete(row: any) {
  try {
    await ElMessageBox.confirm(
      `确定删除管理员「${row.username}」吗？删除后该账号将无法登录。`,
      '删除确认',
      { type: 'warning' }
    );
  } catch {
    return;
  }
  const res = await callFunction('adminManageAdmins', { action: 'delete', adminId: row._id });
  if (res.code === 0) {
    ElMessage.success(res.message || '已删除');
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
.username-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.action-cell {
  white-space: nowrap;
}
</style>
