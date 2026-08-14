<template>
  <div>
    <el-card shadow="never" class="toolbar">
      <div class="toolbar-inner">
        <span class="title">全部猫咪（{{ total }}）</span>
        <el-button @click="load">刷新</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column label="头像" width="90">
          <template #default="{ row }">
            <CloudImage :file-id="row.avatar" width="56px" height="56px" />
          </template>
        </el-table-column>
        <el-table-column label="名字" prop="cat_name" min-width="110">
          <template #default="{ row }">{{ row.cat_name || '未命名猫咪' }}</template>
        </el-table-column>
        <el-table-column label="毛色" prop="color" width="100" />
        <el-table-column label="性别" width="80">
          <template #default="{ row }">{{ GENDER_LABEL[row.gender] || '未知' }}</template>
        </el-table-column>
        <el-table-column label="年龄" width="80">
          <template #default="{ row }">{{ AGE_LABEL[row.age] || '未知' }}</template>
        </el-table-column>
        <el-table-column label="审核状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="特殊状态" width="150">
          <template #default="{ row }">
            <el-tag v-if="row.adopted" size="small" type="success">已领养</el-tag>
            <el-tag v-if="row.passedAway" size="small" type="info">去喵星</el-tag>
            <el-tag v-if="row.missing" size="small" type="warning">失踪</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="300" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="onEdit(row)">编辑</el-button>
            <el-button size="small" @click="toggle(row, 'toggleAdopted')">
              {{ row.adopted ? '取消领养' : '标记领养' }}
            </el-button>
            <el-button size="small" @click="toggle(row, 'togglePassedAway')">
              {{ row.passedAway ? '取消去喵星' : '标记去喵星' }}
            </el-button>
            <el-button size="small" @click="toggle(row, 'toggleMissing')">
              {{ row.missing ? '取消失踪' : '标记失踪' }}
            </el-button>
            <el-button size="small" type="danger" @click="onDelete(row)">删除</el-button>
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

    <!-- 编辑猫咪信息 -->
    <el-dialog v-model="editVisible" :title="`编辑「${editForm.cat_name || '未命名猫咪'}」`" width="520px">
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="名字">
          <el-input v-model="editForm.cat_name" placeholder="猫咪名字" />
        </el-form-item>
        <el-form-item label="毛色">
          <el-select v-model="editForm.color" placeholder="选择毛色" style="width: 100%">
            <el-option v-for="c in COLORS" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="性别">
          <el-select v-model="editForm.gender" style="width: 100%">
            <el-option label="公猫" value="male" />
            <el-option label="母猫" value="female" />
            <el-option label="未知" value="unknown" />
          </el-select>
        </el-form-item>
        <el-form-item label="年龄">
          <el-select v-model="editForm.age" style="width: 100%">
            <el-option label="幼猫" value="kitten" />
            <el-option label="成年猫" value="adult" />
            <el-option label="老年猫" value="elderly" />
            <el-option label="未知" value="unknown" />
          </el-select>
        </el-form-item>
        <el-form-item label="绝育">
          <el-switch v-model="editForm.sterilized" />
        </el-form-item>
        <el-form-item label="疫苗">
          <el-switch v-model="editForm.vaccinated" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="editForm.description"
            type="textarea"
            :rows="4"
            placeholder="猫咪的性格、故事、出没地点等"
          />
        </el-form-item>
        <el-form-item label="照片">
          <div class="photo-grid">
            <div v-for="(p, i) in editForm.photos" :key="p" class="photo-box">
              <CloudImage
                :file-id="p"
                :preview-file-ids="editForm.photos"
                width="80px"
                height="80px"
              />
              <div class="photo-remove" @click="removePhoto(i)">×</div>
            </div>
            <div class="photo-add" @click="triggerUpload">
              <span class="add-plus">+</span>
              <span class="add-text">添加</span>
            </div>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            multiple
            class="hidden-input"
            @change="onFileChange"
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
import CloudImage from '../components/CloudImage.vue';
import { callFunction, uploadImage } from '../api';
import { AGE_LABEL, GENDER_LABEL } from '../labels';

// 毛色选项（与小程序 constants.js 的 COLOR_TAG_MAP 保持一致）
const COLORS = [
  '橘猫', '橘白', '奶牛', '三花', '黑猫', '白猫', '灰猫',
  '狸花', '狸白', '玳瑁', '雀猫', '简州猫', '其他',
];

const list = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);

// 编辑弹窗
const editVisible = ref(false);
const saving = ref(false);
const editId = ref('');
const fileInput = ref<HTMLInputElement>();
const editAvatar = ref(''); // 原始头像 fileID，用于判断是否需要同步更新
const editForm = reactive({
  cat_name: '',
  color: '',
  gender: 'unknown',
  age: 'unknown',
  sterilized: false,
  vaccinated: false,
  description: '',
  photos: [] as string[],
});

function statusText(s: string): string {
  return { pending: '待审核', approved: '已通过', rejected: '已拒绝' }[s] || s || '未知';
}
function statusTagType(s: string): any {
  return { pending: 'warning', approved: 'success', rejected: 'danger' }[s] || 'info';
}

async function load() {
  loading.value = true;
  try {
    const res = await callFunction('getCats', { status: 'all', page: page.value, pageSize });
    if (res.code === 0) {
      list.value = res.data?.cats || [];
      total.value = res.data?.total || 0;
    } else {
      ElMessage.error(res.message || '加载失败');
    }
  } catch (err) {
    console.error('[AllCats] 加载失败:', err);
    ElMessage.error('网络异常');
  } finally {
    loading.value = false;
  }
}

function onPageChange(p: number) {
  page.value = p;
  load();
}

async function toggle(cat: any, action: string) {
  const res = await callFunction('adminUpdateCat', { catId: cat._id, action });
  if (res.code === 0) {
    ElMessage.success('已更新');
    load();
  } else {
    ElMessage.error(res.message || '操作失败');
  }
}

function onEdit(cat: any) {
  editId.value = cat._id;
  editForm.cat_name = cat.cat_name || '';
  editForm.color = cat.color || '';
  editForm.gender = cat.gender || 'unknown';
  editForm.age = cat.age || 'unknown';
  editForm.sterilized = !!cat.health?.sterilized;
  editForm.vaccinated = !!cat.health?.vaccinated;
  editForm.description = cat.description || '';
  editForm.photos = [...(cat.photos || [])];
  editAvatar.value = cat.avatar || '';
  editVisible.value = true;
}

function removePhoto(i: number) {
  editForm.photos.splice(i, 1);
}

function triggerUpload() {
  fileInput.value?.click();
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  if (files.length === 0) return;

  for (const f of files) {
    try {
      const fileId = await uploadImage(f);
      if (fileId) editForm.photos.push(fileId);
    } catch (err: any) {
      ElMessage.error('上传失败：' + (err?.message || '未知错误'));
    }
  }
  input.value = '';
}

async function onSaveEdit() {
  saving.value = true;
  try {
    const updates: Record<string, any> = {
      cat_name: editForm.cat_name.trim() || '未命名猫咪',
      color: editForm.color.trim(),
      gender: editForm.gender,
      age: editForm.age,
      health: {
        sterilized: editForm.sterilized,
        vaccinated: editForm.vaccinated,
      },
      description: editForm.description.trim(),
      photos: editForm.photos,
    };

    // 若原头像不在新照片列表里（被删除/更换），头像回落到第一张
    if (!editForm.photos.includes(editAvatar.value)) {
      updates.avatar = editForm.photos[0] || '';
    }

    const res = await callFunction('adminUpdateCat', {
      catId: editId.value,
      action: 'update',
      updates,
    });
    if (res.code === 0) {
      ElMessage.success(res.message || '信息已更新');
      editVisible.value = false;
      load();
    } else {
      ElMessage.error(res.message || '保存失败');
    }
  } catch (err: any) {
    console.error('[AllCats] 保存失败:', err);
    ElMessage.error(err?.message || '网络异常');
  } finally {
    saving.value = false;
  }
}

async function onDelete(cat: any) {
  const name = cat.cat_name || '未命名猫咪';
  try {
    await ElMessageBox.confirm(
      `确定删除「${name}」吗？将同时删除其关联记录、关系和图片，且不可恢复。`,
      '删除确认',
      { type: 'error', confirmButtonText: '删除', confirmButtonClass: 'el-button--danger' }
    );
  } catch {
    return;
  }
  const res = await callFunction('adminUpdateCat', { catId: cat._id, action: 'delete' });
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
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
.photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.photo-box {
  position: relative;
}
.photo-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #f56c6c;
  color: #fff;
  font-size: 14px;
  line-height: 18px;
  text-align: center;
  cursor: pointer;
}
.photo-add {
  width: 80px;
  height: 80px;
  border: 1px dashed #c0c4cc;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #999;
}
.add-plus {
  font-size: 24px;
  line-height: 1;
}
.add-text {
  font-size: 12px;
}
.hidden-input {
  display: none;
}
</style>
