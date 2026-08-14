<template>
  <div v-loading="loading">
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6"><el-card shadow="hover" class="stat-card"><div class="num">{{ d.catCount ?? '-' }}</div><div class="label">在校猫咪</div></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover" class="stat-card"><div class="num">{{ d.sterilizationRate ?? '-' }}%</div><div class="label">绝育率</div></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover" class="stat-card"><div class="num">{{ d.vaccinationRate ?? '-' }}%</div><div class="label">疫苗率</div></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover" class="stat-card"><div class="num">{{ d.namingRate ?? '-' }}%</div><div class="label">命名率</div></el-card></el-col>
    </el-row>

    <el-row :gutter="16" class="stat-row">
      <el-col :span="6"><el-card shadow="hover" class="stat-card"><div class="num">{{ d.recordCount ?? '-' }}</div><div class="label">记录数</div></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover" class="stat-card"><div class="num">{{ d.todayVisits ?? '-' }}</div><div class="label">今日访问</div></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover" class="stat-card"><div class="num">{{ d.adoptedCount ?? '-' }}</div><div class="label">已领养</div></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover" class="stat-card"><div class="num">{{ (d.passedAwayCount ?? 0) + (d.missingCount ?? 0) }}</div><div class="label">去喵星+失踪</div></el-card></el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="8">
        <el-card shadow="never">
          <template #header>毛色分布</template>
          <div v-for="item in d.catsByColor || []" :key="item.name" class="dist-row">
            <span class="dist-name">{{ item.name }}</span>
            <el-progress :percentage="percent(item.count, maxColor)" :stroke-width="10" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never">
          <template #header>性别分布</template>
          <div v-for="item in d.catsByGender || []" :key="item.name" class="dist-row">
            <span class="dist-name">{{ item.name }}</span>
            <el-progress :percentage="percent(item.count, maxGender)" :stroke-width="10" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never">
          <template #header>年龄分布</template>
          <div v-for="item in d.catsByAge || []" :key="item.name" class="dist-row">
            <span class="dist-name">{{ AGE_LABEL[item.name] || item.name }}</span>
            <el-progress :percentage="percent(item.count, maxAge)" :stroke-width="10" />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { callFunction } from '../api';
import { AGE_LABEL } from '../labels';

const loading = ref(false);
const d = ref<any>({});

const maxColor = computed(() => Math.max(...(d.value.catsByColor || []).map((i: any) => i.count), 1));
const maxGender = computed(() => Math.max(...(d.value.catsByGender || []).map((i: any) => i.count), 1));
const maxAge = computed(() => Math.max(...(d.value.catsByAge || []).map((i: any) => i.count), 1));

function percent(count: number, max: number): number {
  if (!count) return 0;
  return Math.round((count / max) * 100);
}

async function load() {
  loading.value = true;
  try {
    const res = await callFunction('getStats');
    if (res.code === 0) {
      d.value = res.data || {};
    } else {
      ElMessage.error(res.message || '加载失败');
    }
  } catch (err) {
    console.error('[Dashboard] 加载失败:', err);
    ElMessage.error('网络异常');
  } finally {
    loading.value = false;
  }
}

load();
</script>

<style scoped>
.stat-row {
  margin-bottom: 16px;
}
.stat-card {
  text-align: center;
}
.num {
  font-size: 28px;
  font-weight: 700;
  color: #7ec8a8;
}
.label {
  color: #999;
  font-size: 13px;
  margin-top: 4px;
}
.dist-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.dist-name {
  width: 56px;
  color: #666;
  font-size: 13px;
  flex-shrink: 0;
}
</style>
