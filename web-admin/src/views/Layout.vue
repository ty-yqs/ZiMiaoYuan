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
        <el-menu-item v-if="isSuperAdmin" index="/admins">子管理员管理</el-menu-item>
        <el-menu-item index="/dashboard">数据看板</el-menu-item>
        <el-menu-item index="/feedbacks">用户反馈</el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <el-dropdown trigger="click" @command="onCommand">
          <span class="user-trigger">
            {{ username }}
            <span class="caret">▾</span>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="changePassword">修改密码</el-dropdown-item>
              <el-dropdown-item command="clearCache">清除图片缓存</el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>

    <!-- 修改密码对话框 -->
    <el-dialog v-model="changeVisible" title="修改密码" width="420px">
      <el-form label-width="80px">
        <el-form-item label="原密码">
          <el-input
            v-model="changeForm.oldPassword"
            type="password"
            show-password
            placeholder="请输入原密码"
          />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input
            v-model="changeForm.newPassword"
            type="password"
            show-password
            placeholder="至少 6 位"
          />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input
            v-model="changeForm.confirmPassword"
            type="password"
            show-password
            placeholder="再次输入新密码"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="changeVisible = false">取消</el-button>
        <el-button type="primary" :loading="changing" @click="onSavePassword">保存</el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { clearAuth, getUsername, isSuper } from '../auth';
import { clearImageCache } from '../imageCache';
import { callFunction } from '../api';

const route = useRoute();
const router = useRouter();
const username = getUsername() || '管理员';
const isSuperAdmin = isSuper();
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

const changeVisible = ref(false);
const changing = ref(false);
const changeForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

function onChangePassword() {
  changeForm.oldPassword = '';
  changeForm.newPassword = '';
  changeForm.confirmPassword = '';
  changeVisible.value = true;
}

async function onSavePassword() {
  if (!changeForm.oldPassword) {
    ElMessage.warning('请输入原密码');
    return;
  }
  if (!changeForm.newPassword || changeForm.newPassword.length < 6) {
    ElMessage.warning('新密码至少 6 位');
    return;
  }
  if (changeForm.newPassword !== changeForm.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致');
    return;
  }
  changing.value = true;
  try {
    const res = await callFunction('adminManageAdmins', {
      action: 'changePassword',
      oldPassword: changeForm.oldPassword,
      newPassword: changeForm.newPassword,
    });
    if (res.code === 0) {
      ElMessage.success(res.message || '密码已修改');
      changeVisible.value = false;
    } else {
      ElMessage.error(res.message || '修改失败');
    }
  } catch (err: any) {
    console.error('[Layout] 修改密码失败:', err);
    ElMessage.error(err?.message || '网络异常');
  } finally {
    changing.value = false;
  }
}

function onCommand(cmd: string) {
  if (cmd === 'changePassword') onChangePassword();
  else if (cmd === 'clearCache') onClearImageCache();
  else if (cmd === 'logout') onLogout();
}

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
.user-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  outline: none;
}
.caret {
  font-size: 12px;
  color: #999;
}
.main {
  padding: 20px;
}
</style>
