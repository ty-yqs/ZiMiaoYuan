<template>
  <div>
    <el-card shadow="never" class="toolbar">
      <div class="toolbar-inner">
        <span class="title">用户管理（{{ total }}）</span>
        <div class="filters">
          <el-input
            v-model="keyword"
            placeholder="按昵称搜索"
            clearable
            style="width: 200px"
            @keyup.enter="onSearch"
            @clear="onSearch"
          />
          <el-select v-model="roleFilter" placeholder="角色" style="width: 120px" @change="onSearch">
            <el-option label="全部角色" value="" />
            <el-option label="管理员" value="admin" />
            <el-option label="普通用户" value="student" />
          </el-select>
          <el-button type="primary" @click="onSearch">搜索</el-button>
          <el-button @click="load">刷新</el-button>
        </div>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column label="头像" width="70">
          <template #default="{ row }">
            <CloudImage v-if="row.avatar" :file-id="row.avatar" width="40px" height="40px" />
            <div v-else class="avatar-letter">{{ (row.nickname || '匿').charAt(0) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="昵称" min-width="120">
          <template #default="{ row }">{{ row.nickname || '未设置昵称' }}</template>
        </el-table-column>
        <el-table-column label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'danger' : 'info'" size="small">
              {{ row.role === 'admin' ? '管理员' : '普通用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.banned ? 'danger' : 'success'" size="small" effect="plain">
              {{ row.banned ? '已封禁' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发现猫数" width="90" prop="catCount" />
        <el-table-column label="记录数" width="80" prop="recordCount" />
        <el-table-column label="注册时间" width="150">
          <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="最后登录" width="150">
          <template #default="{ row }">{{ formatTime(row.lastLoginTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="toggleRole(row)">
              {{ row.role === 'admin' ? '设为普通用户' : '设为管理员' }}
            </el-button>
            <el-button
              size="small"
              :type="row.banned ? 'success' : 'danger'"
              @click="toggleBan(row)"
            >
              {{ row.banned ? '解封' : '封禁' }}
            </el-button>
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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import CloudImage from '../components/CloudImage.vue';
import { callFunction } from '../api';
import { formatTime } from '../labels';

const list = ref<any[]>([]);
const loading = ref(false);
const keyword = ref('');
const roleFilter = ref('');
const page = ref(1);
const pageSize = 20;
const total = ref(0);

async function load() {
  loading.value = true;
  try {
    const res = await callFunction('getUsers', {
      keyword: keyword.value,
      role: roleFilter.value,
      page: page.value,
      pageSize,
    });
    if (res.code === 0) {
      list.value = res.data?.users || [];
      total.value = res.data?.total || 0;
    } else {
      ElMessage.error(res.message || '加载失败');
    }
  } catch (err: any) {
    console.error('[Users] 加载失败:', err);
    ElMessage.error(err?.message || '网络异常');
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  page.value = 1;
  load();
}

function onPageChange(p: number) {
  page.value = p;
  load();
}

async function toggleRole(u: any) {
  const targetRole = u.role === 'admin' ? 'student' : 'admin';
  const tip = targetRole === 'admin' ? '设为管理员' : '设为普通用户';
  try {
    await ElMessageBox.confirm(
      `确定将「${u.nickname || '未设置昵称'}」${tip}吗？`,
      '修改角色',
      { type: 'warning' }
    );
  } catch {
    return;
  }
  const res = await callFunction('adminUpdateUser', { userId: u._id, action: 'setRole', role: targetRole });
  if (res.code === 0) {
    ElMessage.success(res.message || '已更新');
    load();
  } else {
    ElMessage.error(res.message || '操作失败');
  }
}

async function toggleBan(u: any) {
  const willBan = !u.banned;
  try {
    await ElMessageBox.confirm(
      willBan
        ? `确定封禁「${u.nickname || '未设置昵称'}」吗？封禁后该用户将无法登录使用。`
        : `确定解封「${u.nickname || '未设置昵称'}」吗？`,
      willBan ? '封禁确认' : '解封确认',
      { type: willBan ? 'error' : 'warning' }
    );
  } catch {
    return;
  }
  const res = await callFunction('adminUpdateUser', { userId: u._id, action: 'setBanned', banned: willBan });
  if (res.code === 0) {
    ElMessage.success(res.message || '已更新');
    load();
  } else {
    ElMessage.error(res.message || '操作失败');
  }
}

load();
</script>

<style scoped>
.toolbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}
.filters {
  display: flex;
  align-items: center;
  gap: 8px;
}
.avatar-letter {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  background: #7ec8a8;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
}
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
