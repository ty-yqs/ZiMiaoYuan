<template>
  <div>
    <el-card shadow="never" class="toolbar">
      <div class="toolbar-inner">
        <span class="title">功能设置</span>
        <el-button @click="load">刷新</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <div class="desc">
        控制小程序端各项内容的浏览开放状态。关闭后，对应功能将不再展示内容，用户无法浏览。
      </div>

      <el-form label-width="200px" class="settings-form">
        <el-form-item label="开放浏览动态页面">
          <el-switch v-model="form.feedOpen" :disabled="loading" />
          <span class="hint">小程序「动态」页的全局发现记录瀑布流</span>
        </el-form-item>
        <el-form-item label="开放浏览用户发现记录">
          <el-switch v-model="form.recordsOpen" :disabled="loading" />
          <span class="hint">猫咪详情页的「发现记录」板块及记录列表</span>
        </el-form-item>
        <el-form-item label="开放浏览便利贴">
          <el-switch v-model="form.notesOpen" :disabled="loading" />
          <span class="hint">猫咪详情页的「便利贴」板块及「写便利贴」入口</span>
        </el-form-item>
      </el-form>

      <div class="actions">
        <el-button type="primary" :loading="saving" @click="onSave">保存设置</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { callFunction } from '../api';

const loading = ref(false);
const saving = ref(false);

const form = reactive({
  feedOpen: true,
  recordsOpen: true,
  notesOpen: true,
});

async function load() {
  loading.value = true;
  try {
    const res = await callFunction<{
      feedOpen: boolean;
      recordsOpen: boolean;
      notesOpen: boolean;
    }>('manageSettings', { action: 'get' });
    if (res.code === 0 && res.data) {
      form.feedOpen = res.data.feedOpen !== false;
      form.recordsOpen = res.data.recordsOpen !== false;
      form.notesOpen = res.data.notesOpen !== false;
    } else {
      ElMessage.error(res.message || '加载失败');
    }
  } catch (err: any) {
    console.error('[Settings] 加载失败:', err);
    ElMessage.error(err?.message || '网络异常');
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  saving.value = true;
  try {
    const res = await callFunction('manageSettings', {
      action: 'update',
      feedOpen: form.feedOpen,
      recordsOpen: form.recordsOpen,
      notesOpen: form.notesOpen,
    });
    if (res.code === 0) {
      ElMessage.success(res.message || '设置已保存');
    } else {
      ElMessage.error(res.message || '保存失败');
    }
  } catch (err: any) {
    console.error('[Settings] 保存失败:', err);
    ElMessage.error(err?.message || '网络异常');
  } finally {
    saving.value = false;
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
.desc {
  font-size: 13px;
  color: #999;
  margin-bottom: 20px;
}
.settings-form {
  max-width: 640px;
}
.hint {
  margin-left: 12px;
  font-size: 13px;
  color: #999;
}
.actions {
  margin-top: 8px;
  padding-left: 200px;
}
</style>
