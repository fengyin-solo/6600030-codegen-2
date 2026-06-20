import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { FEAModel, FEAResult, LoadCase, Load } from '../types';
import {
  solve as feaSolve,
  presetCantileverBeam,
  presetBridgeTruss,
  presetSimpleFrame,
  jetColormap,
} from '../utils/fea-solver';

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const useFEAStore = defineStore('fea', () => {
  const model = ref<FEAModel>({ nodes: [], elements: [], loads: [] });
  const result = ref<FEAResult | null>(null);
  const selectedPreset = ref<string>('cantilever');
  const showDeformed = ref(false);
  const deformationScale = ref(10);
  const selectedElement = ref<number | null>(null);
  const heatmapMode = ref<'stress' | 'strain' | 'force'>('stress');

  const loadCases = ref<LoadCase[]>([]);
  const activeLoadCaseId = ref<string | null>(null);

  // ─── Actions ──────────────────────────────────────────────────────────────
  function loadPreset(name: string) {
    selectedPreset.value = name;
    result.value = null;
    selectedElement.value = null;
    let presetModel: FEAModel;
    switch (name) {
      case 'cantilever':
        presetModel = presetCantileverBeam();
        break;
      case 'bridge':
        presetModel = presetBridgeTruss();
        break;
      case 'frame':
        presetModel = presetSimpleFrame();
        break;
      default:
        presetModel = presetCantileverBeam();
    }
    model.value = presetModel;

    loadCases.value = [];
    if (presetModel.loads.length > 0) {
      const defaultCase: LoadCase = {
        id: generateId(),
        name: '默认工况',
        description: name + ' 初始载荷',
        loads: JSON.parse(JSON.stringify(presetModel.loads)),
      };
      loadCases.value.push(defaultCase);
      activeLoadCaseId.value = defaultCase.id;
    } else {
      activeLoadCaseId.value = null;
    }
  }

  function solve() {
    result.value = feaSolve(model.value);
  }

  function toggleDeformed() {
    showDeformed.value = !showDeformed.value;
  }

  function selectElement(id: number | null) {
    selectedElement.value = id;
  }

  function setHeatmapMode(mode: 'stress' | 'strain' | 'force') {
    heatmapMode.value = mode;
  }

  function addLoad(nodeId: number, fx: number, fy: number) {
    model.value.loads.push({ nodeId, fx, fy });
  }

  function toggleFixed(nodeId: number) {
    const node = model.value.nodes.find((n) => n.id === nodeId);
    if (node) node.fixed = !node.fixed;
  }

  function createLoadCase(name: string, description: string = '') {
    const newCase: LoadCase = {
      id: generateId(),
      name,
      description,
      loads: [],
    };
    loadCases.value.push(newCase);
    activeLoadCaseId.value = newCase.id;
    model.value.loads = [];
    result.value = null;
    return newCase;
  }

  function deleteLoadCase(id: string) {
    const idx = loadCases.value.findIndex((c) => c.id === id);
    if (idx === -1) return;
    loadCases.value.splice(idx, 1);
    if (activeLoadCaseId.value === id) {
      if (loadCases.value.length > 0) {
        activeLoadCaseId.value = loadCases.value[0].id;
        applyLoadCase(activeLoadCaseId.value);
      } else {
        activeLoadCaseId.value = null;
        model.value.loads = [];
        result.value = null;
      }
    }
  }

  function applyLoadCase(id: string) {
    const loadCase = loadCases.value.find((c) => c.id === id);
    if (!loadCase) return;
    activeLoadCaseId.value = id;
    model.value.loads = JSON.parse(JSON.stringify(loadCase.loads));
    result.value = null;
  }

  function renameLoadCase(id: string, name: string) {
    const loadCase = loadCases.value.find((c) => c.id === id);
    if (loadCase) loadCase.name = name;
  }

  function updateLoadCaseDescription(id: string, description: string) {
    const loadCase = loadCases.value.find((c) => c.id === id);
    if (loadCase) loadCase.description = description;
  }

  function saveActiveLoadCase() {
    if (!activeLoadCaseId.value) return;
    const loadCase = loadCases.value.find((c) => c.id === activeLoadCaseId.value);
    if (loadCase) {
      loadCase.loads = JSON.parse(JSON.stringify(model.value.loads));
    }
  }

  function duplicateLoadCase(id: string) {
    const loadCase = loadCases.value.find((c) => c.id === id);
    if (!loadCase) return;
    const newCase: LoadCase = {
      id: generateId(),
      name: loadCase.name + ' 副本',
      description: loadCase.description,
      loads: JSON.parse(JSON.stringify(loadCase.loads)),
    };
    loadCases.value.push(newCase);
    activeLoadCaseId.value = newCase.id;
    model.value.loads = JSON.parse(JSON.stringify(newCase.loads));
    result.value = null;
    return newCase;
  }

  function setNodeLoad(nodeId: number, fx: number, fy: number) {
    const existingIdx = model.value.loads.findIndex((l) => l.nodeId === nodeId);
    if (fx === 0 && fy === 0) {
      if (existingIdx !== -1) model.value.loads.splice(existingIdx, 1);
    } else {
      if (existingIdx !== -1) {
        model.value.loads[existingIdx] = { nodeId, fx, fy };
      } else {
        model.value.loads.push({ nodeId, fx, fy });
      }
    }
    result.value = null;
  }

  function removeNodeLoad(nodeId: number) {
    const idx = model.value.loads.findIndex((l) => l.nodeId === nodeId);
    if (idx !== -1) model.value.loads.splice(idx, 1);
    result.value = null;
  }

  function batchSetLoads(nodeIds: number[], fx: number, fy: number) {
    for (const nodeId of nodeIds) {
      setNodeLoad(nodeId, fx, fy);
    }
  }

  function clearAllLoads() {
    model.value.loads = [];
    result.value = null;
  }

  // ─── Computed ─────────────────────────────────────────────────────────────
  const activeLoadCase = computed(() => {
    if (!activeLoadCaseId.value) return null;
    return loadCases.value.find((c) => c.id === activeLoadCaseId.value) || null;
  });

  const loadedNodes = computed(() => {
    return new Set(model.value.loads.map((l) => l.nodeId));
  });

  const maxStress = computed(() => {
    if (!result.value) return 0;
    return result.value.maxStress;
  });

  const maxDisplacement = computed(() => {
    if (!result.value) return 0;
    return result.value.maxDisplacement;
  });

  const elementColors = computed(() => {
    const colors = new Map<number, string>();
    if (!result.value || model.value.elements.length === 0) {
      for (const el of model.value.elements) {
        colors.set(el.id, '#6b7280');
      }
      return colors;
    }

    let values: number[];
    switch (heatmapMode.value) {
      case 'stress':
        values = result.value.stresses.map(Math.abs);
        break;
      case 'strain':
        values = result.value.strains.map(Math.abs);
        break;
      case 'force':
        values = model.value.elements.map((e) => Math.abs(e.force));
        break;
      default:
        values = result.value.stresses.map(Math.abs);
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    for (let i = 0; i < model.value.elements.length; i++) {
      colors.set(
        model.value.elements[i].id,
        jetColormap(values[i], min, max)
      );
    }
    return colors;
  });

  return {
    model,
    result,
    selectedPreset,
    showDeformed,
    deformationScale,
    selectedElement,
    heatmapMode,
    loadCases,
    activeLoadCaseId,
    activeLoadCase,
    loadedNodes,
    maxStress,
    maxDisplacement,
    elementColors,
    loadPreset,
    solve,
    toggleDeformed,
    selectElement,
    setHeatmapMode,
    addLoad,
    toggleFixed,
    createLoadCase,
    deleteLoadCase,
    applyLoadCase,
    renameLoadCase,
    updateLoadCaseDescription,
    saveActiveLoadCase,
    duplicateLoadCase,
    setNodeLoad,
    removeNodeLoad,
    batchSetLoads,
    clearAllLoads,
  };
});
