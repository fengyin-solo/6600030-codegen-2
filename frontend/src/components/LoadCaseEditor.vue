<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useFEAStore } from '../store/fea';

const store = useFEAStore();

const selectedNodeIds = ref<Set<number>>(new Set());
const batchAngle = ref(270);
const batchMagnitude = ref(10);
const newCaseName = ref('');
const renamingId = ref<string | null>(null);
const renameInput = ref('');

const activeCase = computed(() => store.activeLoadCase);

const batchFx = computed(() => {
  const rad = (batchAngle.value * Math.PI) / 180;
  return Math.round(Math.cos(rad) * batchMagnitude.value * 1000);
});

const batchFy = computed(() => {
  const rad = (batchAngle.value * Math.PI) / 180;
  return Math.round(Math.sin(rad) * batchMagnitude.value * 1000);
});

function toggleNodeSelection(nodeId: number) {
  if (selectedNodeIds.value.has(nodeId)) {
    selectedNodeIds.value.delete(nodeId);
  } else {
    selectedNodeIds.value.add(nodeId);
  }
  selectedNodeIds.value = new Set(selectedNodeIds.value);
}

function selectAllNodes() {
  selectedNodeIds.value = new Set(store.model.nodes.map((n) => n.id));
}

function clearSelection() {
  selectedNodeIds.value = new Set();
}

function applyBatchLoad() {
  if (selectedNodeIds.value.size === 0) return;
  store.batchSetLoads(Array.from(selectedNodeIds.value), batchFx.value, batchFy.value);
  store.saveActiveLoadCase();
}

function handleCreateCase() {
  if (!newCaseName.value.trim()) return;
  store.createLoadCase(newCaseName.value.trim());
  newCaseName.value = '';
}

function startRename(id: string, name: string) {
  renamingId.value = id;
  renameInput.value = name;
}

function commitRename(id: string) {
  if (renameInput.value.trim()) {
    store.renameLoadCase(id, renameInput.value.trim());
  }
  renamingId.value = null;
}

function getNodeLoad(nodeId: number) {
  return store.model.loads.find((l) => l.nodeId === nodeId) || null;
}

function updateNodeLoad(nodeId: number, field: 'fx' | 'fy', value: number) {
  const load = getNodeLoad(nodeId);
  const fx = load ? load.fx : 0;
  const fy = load ? load.fy : 0;
  if (field === 'fx') {
    store.setNodeLoad(nodeId, value, fy);
  } else {
    store.setNodeLoad(nodeId, fx, value);
  }
  store.saveActiveLoadCase();
}

function removeLoad(nodeId: number) {
  store.removeNodeLoad(nodeId);
  store.saveActiveLoadCase();
}

function handleApplyCase(id: string) {
  store.applyLoadCase(id);
  selectedNodeIds.value = new Set();
}

function handleDeleteCase(id: string) {
  store.deleteLoadCase(id);
}

function handleDuplicateCase(id: string) {
  store.duplicateLoadCase(id);
}

function handleSaveCase() {
  store.saveActiveLoadCase();
}

function handleClearLoads() {
  store.clearAllLoads();
  store.saveActiveLoadCase();
}

function handleResetLoadCases() {
  if (confirm('确定要重置所有工况吗？这将清除所有自定义工况并恢复默认工况。')) {
    store.resetLoadCases();
    selectedNodeIds.value = new Set();
  }
}

watch(
  () => store.activeLoadCaseId,
  () => {
    selectedNodeIds.value = new Set();
  }
);
</script>

<template>
  <div class="bg-slate-800 rounded-lg p-4 space-y-3">
    <h3 class="text-sm font-bold text-slate-200 border-b border-slate-700 pb-2">
      📋 载荷工况管理
    </h3>

    <!-- Case list -->
    <div class="space-y-1.5">
      <div class="text-xs text-slate-400">工况列表</div>
      <div v-if="store.loadCases.length === 0" class="text-xs text-slate-500 py-2 text-center">
        暂无工况，请创建新工况
      </div>
      <div v-else class="space-y-1 max-h-32 overflow-y-auto">
        <div
          v-for="lc in store.loadCases"
          :key="lc.id"
          class="flex items-center gap-1.5 group"
        >
          <button
            v-if="renamingId !== lc.id"
            @click="handleApplyCase(lc.id)"
            :class="[
              'flex-1 text-left px-2 py-1 rounded text-xs transition truncate',
              store.activeLoadCaseId === lc.id
                ? 'bg-sky-700 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
            ]"
          >
            {{ lc.name }}
            <span v-if="lc.loads.length > 0" class="text-[10px] opacity-70 ml-1">
              ({{ lc.loads.length }})
            </span>
          </button>
          <input
            v-else
            ref="renameInput"
            v-model="renameInput"
            @keyup.enter="commitRename(lc.id)"
            @blur="commitRename(lc.id)"
            class="flex-1 px-2 py-1 rounded text-xs bg-slate-900 text-white border border-sky-500 outline-none"
            placeholder="工况名称"
          />
          <button
            @click="startRename(lc.id, lc.name)"
            class="p-1 text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition"
            title="重命名"
          >
            ✏️
          </button>
          <button
            @click="handleDuplicateCase(lc.id)"
            class="p-1 text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition"
            title="复制工况"
          >
            📋
          </button>
          <button
            @click="handleDeleteCase(lc.id)"
            class="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
            title="删除工况"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>

    <!-- Create new case -->
    <div class="flex gap-1.5">
      <input
        v-model="newCaseName"
        @keyup.enter="handleCreateCase"
        class="flex-1 px-2 py-1.5 rounded text-xs bg-slate-900 text-white border border-slate-700 outline-none focus:border-sky-500"
        placeholder="新工况名称"
      />
      <button
        @click="handleCreateCase"
        :disabled="!newCaseName.trim()"
        class="px-3 py-1.5 rounded text-xs font-medium bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        新建
      </button>
    </div>

    <!-- Reset button -->
    <button
      @click="handleResetLoadCases"
      class="w-full py-1.5 rounded text-[11px] text-slate-400 hover:text-amber-300 hover:bg-slate-700/50 border border-dashed border-slate-700 hover:border-amber-600/50 transition"
      title="将当前预设的所有工况重置为默认状态"
    >
      🔄 重置为默认工况
    </button>

    <!-- Active case editor -->
    <div v-if="activeCase" class="border-t border-slate-700 pt-3 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-slate-200">
          当前工况: <span class="text-sky-400">{{ activeCase.name }}</span>
        </span>
        <button
          @click="handleSaveCase"
          class="px-2 py-1 rounded text-[10px] bg-sky-700 text-white hover:bg-sky-600 transition"
        >
          💾 保存
        </button>
      </div>

      <!-- Description -->
      <div>
        <div class="text-[10px] text-slate-500 mb-1">工况描述</div>
        <input
          :value="activeCase.description"
          @input="store.updateLoadCaseDescription(activeCase.id, ($event.target as HTMLInputElement).value)"
          class="w-full px-2 py-1 rounded text-xs bg-slate-900 text-white border border-slate-700 outline-none focus:border-sky-500"
          placeholder="工况描述（可选）"
        />
      </div>

      <!-- Batch load section -->
      <div class="bg-slate-900/50 rounded p-2.5 space-y-2">
        <div class="text-xs font-medium text-amber-400">⚡ 批量设置载荷</div>

        <!-- Direction -->
        <div>
          <div class="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>方向角度</span>
            <span class="text-sky-400 font-mono">{{ batchAngle }}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            v-model.number="batchAngle"
            class="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div class="flex justify-between text-[10px] text-slate-600 mt-0.5">
            <span>→ 0°</span>
            <span>↑ 90°</span>
            <span>← 180°</span>
            <span>↓ 270°</span>
          </div>
        </div>

        <!-- Magnitude -->
        <div>
          <div class="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>载荷大小</span>
            <span class="text-amber-400 font-mono">{{ batchMagnitude }} kN</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="500"
            step="0.1"
            v-model.number="batchMagnitude"
            class="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>

        <!-- Preview -->
        <div class="grid grid-cols-2 gap-1.5 text-[10px]">
          <div class="bg-slate-800 rounded px-2 py-1">
            <span class="text-slate-500">Fx = </span>
            <span class="text-sky-400 font-mono">{{ (batchFx / 1000).toFixed(1) }} kN</span>
          </div>
          <div class="bg-slate-800 rounded px-2 py-1">
            <span class="text-slate-500">Fy = </span>
            <span class="text-sky-400 font-mono">{{ (batchFy / 1000).toFixed(1) }} kN</span>
          </div>
        </div>

        <!-- Node selection -->
        <div>
          <div class="flex justify-between items-center text-[10px] text-slate-400 mb-1">
            <span>选择节点 ({{ selectedNodeIds.size }})</span>
            <div class="flex gap-1">
              <button
                @click="selectAllNodes"
                class="text-sky-500 hover:text-sky-400"
              >
                全选
              </button>
              <span class="text-slate-600">|</span>
              <button
                @click="clearSelection"
                class="text-slate-500 hover:text-slate-400"
              >
                清空
              </button>
            </div>
          </div>
          <div class="max-h-24 overflow-y-auto flex flex-wrap gap-1 p-1.5 bg-slate-800 rounded border border-slate-700">
            <button
              v-for="node in store.model.nodes"
              :key="node.id"
              @click="toggleNodeSelection(node.id)"
              :class="[
                'px-1.5 py-0.5 rounded text-[10px] font-mono transition',
                selectedNodeIds.has(node.id)
                  ? 'bg-amber-600 text-white'
                  : store.loadedNodes.has(node.id)
                    ? 'bg-red-900/50 text-red-300 hover:bg-red-800/50'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600',
              ]"
              :title="`节点 #${node.id} (x=${node.x.toFixed(2)}, y=${node.y.toFixed(2)})`"
            >
              #{{ node.id }}
            </button>
          </div>
        </div>

        <!-- Apply batch button -->
        <div class="flex gap-1.5">
          <button
            @click="applyBatchLoad"
            :disabled="selectedNodeIds.size === 0"
            class="flex-1 py-1.5 rounded text-xs font-bold bg-amber-700 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            应用到选中节点
          </button>
          <button
            @click="handleClearLoads"
            class="px-3 py-1.5 rounded text-xs font-medium bg-slate-700 text-slate-300 hover:bg-red-800 hover:text-white transition"
            title="清除所有载荷"
          >
            🧹
          </button>
        </div>
      </div>

      <!-- Individual load list -->
      <div>
        <div class="text-xs font-medium text-slate-300 mb-1.5">
          📌 当前载荷列表 ({{ store.model.loads.length }})
        </div>
        <div
          v-if="store.model.loads.length === 0"
          class="text-[10px] text-slate-500 text-center py-3 bg-slate-900/50 rounded"
        >
          暂无载荷，请在上方选择节点并批量添加
        </div>
        <div v-else class="space-y-1 max-h-40 overflow-y-auto">
          <div
            v-for="load in store.model.loads"
            :key="load.nodeId"
            class="bg-slate-900 rounded p-1.5 flex items-center gap-1.5"
          >
            <span class="text-[10px] font-mono text-slate-300 w-10">
              #{{ load.nodeId }}
            </span>
            <div class="flex-1 grid grid-cols-2 gap-1">
              <div class="flex items-center gap-1">
                <span class="text-[9px] text-slate-500">Fx</span>
                <input
                  type="number"
                  :value="Math.round(load.fx / 100) / 10"
                  @change="updateNodeLoad(load.nodeId, 'fx', Math.round(Number(($event.target as HTMLInputElement).value) * 1000))"
                  class="w-full px-1 py-0.5 rounded text-[10px] bg-slate-800 text-sky-300 text-right border border-slate-700 outline-none focus:border-sky-500 font-mono"
                  step="0.1"
                />
                <span class="text-[9px] text-slate-500">kN</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="text-[9px] text-slate-500">Fy</span>
                <input
                  type="number"
                  :value="Math.round(load.fy / 100) / 10"
                  @change="updateNodeLoad(load.nodeId, 'fy', Math.round(Number(($event.target as HTMLInputElement).value) * 1000))"
                  class="w-full px-1 py-0.5 rounded text-[10px] bg-slate-800 text-sky-300 text-right border border-slate-700 outline-none focus:border-sky-500 font-mono"
                  step="0.1"
                />
                <span class="text-[9px] text-slate-500">kN</span>
              </div>
            </div>
            <button
              @click="removeLoad(load.nodeId)"
              class="p-0.5 text-slate-500 hover:text-red-400 transition text-xs"
              title="移除载荷"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else
      class="border-t border-slate-700 pt-3 text-xs text-slate-500 text-center py-4"
    >
      请先创建或选择一个载荷工况
    </div>
  </div>
</template>
