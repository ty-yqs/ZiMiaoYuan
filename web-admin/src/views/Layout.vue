<template>
  <el-container class="layout">
    <el-aside width="200px" class="aside">
      <div class="logo">紫喵园后台</div>
      <el-menu :default-active="activePath" router class="menu">
        <el-sub-menu index="review">
          <template #title>审核中心</template>
          <el-menu-item index="/review/cats">待审核猫咪（{{ counts.cats }}）</el-menu-item>
          <el-menu-item index="/review/edits">编辑提案（{{ counts.edits }}）</el-menu-item>
          <el-menu-item index="/review/records">记录审核（{{ counts.records }}）</el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/cats">全部猫咪</el-menu-item>
        <el-menu-item index="/records">记录管理</el-menu-item>
        <el-menu-item index="/users">用户管理</el-menu-item>
        <el-menu-item index="/supporters">赞助管理</el-menu-item>
        <el-menu-item index="/dashboard">数据看板</el-menu-item>
        <el-menu-item index="/feedbacks">用户反馈</el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <span class="username">{{ username }}</span>
        <el-button link @click="onClearImageCache">清除图片缓存</el-button>
        <el-button link type="danger" @click="onLogout">退出登录</el-button>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { clearAuth, getUsername } from '../auth';
import { clearImageCache } from '../imageCache';
import { callFunction } from '../api';

const route = useRoute();
const router = useRouter();
const username = getUsername() || '管理员';
const activePath = computed(() => route.path);

// 审核中心三个标签的待审核数量（无则显示 0）
const counts = reactive({ cats: 0, edits: 0, records: 0 });

async function loadPendingCounts() {
  try {
    const res = await callFunction<{ cats: number; edits: number; records: number }>(
      'getPendingCounts',
      {}
    );
    if (res.code === 0 && res.data) {
      counts.cats = res.data.cats || 0;
      counts.edits = res.data.edits || 0;
      counts.records = res.data.records || 0;
    }
  } catch (err) {
    console.error('[Layout] 获取待审核数量失败:', err);
  }
}

loadPendingCounts();
// 路由变化后刷新数量（审核操作后返回会重新统计）
watch(() => route.path, loadPendingCounts);

function onClearImageCache() {
  clearImageCache();
  ElMessage.success('图片缓存已清除');
}

function onLogout() {
  clearAuth();
  router.push('/login');
}
</script>

<style scoped>
.layout {
  height: 100%;
}
.aside {
  background: #fff;
  border-right: 1px solid #e5e7eb;
}
.logo {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  font-weight: 600;
  color: #333;
  border-bottom: 1px solid #f0f0f0;
}
.menu {
  border-right: none;
}
.header {
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
}
.username {
  color: #666;
  font-size: 14px;
}
.main {
  padding: 20px;
}
</style>
