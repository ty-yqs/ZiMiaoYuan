<template>
  <el-image
    :src="url"
    :fit="fit"
    :style="style"
    :preview-src-list="previewUrls"
    :initial-index="initialIndex"
    preview-teleported
  >
    <template #error>
      <div class="cloud-img-placeholder">无图</div>
    </template>
    <template #placeholder>
      <div class="cloud-img-placeholder">加载中</div>
    </template>
  </el-image>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { resolveImageUrl } from '../imageCache';

const props = withDefaults(
  defineProps<{
    fileId: string;
    /** 可选：同一组照片的完整 fileID 列表，用于点击后左右切换预览 */
    previewFileIds?: string[];
    fit?: string;
    width?: string;
    height?: string;
  }>(),
  { fit: 'cover', width: '80px', height: '80px', previewFileIds: () => [] }
);

const url = ref('');
const previewUrls = ref<string[]>([]);
const initialIndex = ref(0);
const style = {
  width: props.width,
  height: props.height,
  borderRadius: '6px',
  overflow: 'hidden',
};

watch(
  () => [props.fileId, props.previewFileIds] as const,
  async ([id, ids]) => {
    url.value = '';
    if (id) url.value = await resolveImageUrl(id);

    // 预览列表：优先用传入的整组，否则单图
    const list = (ids && ids.length > 0 ? ids : id ? [id] : []).filter(Boolean);
    const resolved = await Promise.all(list.map((x) => resolveImageUrl(x)));
    previewUrls.value = resolved.filter(Boolean);
    initialIndex.value = Math.max(0, list.indexOf(id));
  },
  { immediate: true }
);
</script>

<style scoped>
.cloud-img-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #c0c4cc;
  font-size: 12px;
  background: #f5f7fa;
}
</style>
