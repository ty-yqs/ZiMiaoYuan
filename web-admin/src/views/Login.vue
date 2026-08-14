<template>
  <div class="login-page">
    <el-card class="login-card">
      <div class="login-title">
        <span class="logo">🐱</span>
        <h2>紫喵园 · 管理后台</h2>
      </div>

      <el-form @submit.prevent="onSubmit">
        <el-form-item>
          <el-input v-model="username" placeholder="用户名" size="large" />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="password"
            type="password"
            placeholder="密码"
            size="large"
            show-password
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          :loading="loading"
          style="width: 100%"
          @click="onSubmit"
        >
          登录
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { callFunction } from '../api';
import { setAuth } from '../auth';

const router = useRouter();
const username = ref('');
const password = ref('');
const loading = ref(false);

async function onSubmit() {
  if (!username.value.trim() || !password.value) {
    ElMessage.warning('请输入用户名和密码');
    return;
  }
  if (loading.value) return;

  loading.value = true;
  try {
    const res = await callFunction<{ token: string; username: string; expiresAt: number }>(
      'adminLogin',
      { username: username.value.trim(), password: password.value }
    );

    if (res.code === 0 && res.data) {
      setAuth(res.data.token, res.data.username, res.data.expiresAt);
      ElMessage.success('登录成功');
      router.push('/');
    } else {
      ElMessage.error(res.message || '登录失败');
    }
  } catch (err: any) {
    console.error('[Login] 登录异常:', err);
    ElMessage.error(err?.message || err?.errMsg || '网络异常，请重试');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #7ec8a8 0%, #f2a65a 100%);
}
.login-card {
  width: 360px;
  padding: 8px 12px;
  border-radius: 12px;
}
.login-title {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  margin-bottom: 24px;
}
.login-title .logo {
  font-size: 28px;
}
.login-title h2 {
  font-size: 20px;
  margin: 0;
  color: #333;
}
</style>
