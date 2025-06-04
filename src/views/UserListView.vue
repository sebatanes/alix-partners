<template>
  <div class="org-chart-container">
    <!-- 
      Acá aplicamos el principio del libro: dejamos que Vue maneje el DOM
      En lugar de que D3 genere y manipule elementos DOM, Vue se encarga del template
      Esto es mucho más performante porque evitamos las manipulaciones DOM constantes
    -->
    <div class="controls">
      <button @click="toggleExpandAll" class="control-button">
        {{ expandAll ? 'Collapse All' : 'Expand All' }}
      </button>
      <button @click="resetZoom" class="control-button">
        Reset Zoom
      </button>
    </div>
    
    <!-- 
      CLAVE: Usamos Canvas en lugar de SVG como recomienda el libro
      Canvas es mucho más performante para visualizaciones complejas
      porque renderiza directo al bitmap en lugar de mantener objetos DOM
    -->
    <canvas 
      ref="canvasRef" 
      class="chart-canvas"
      @wheel="handleWheel"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @click="handleClick"
    ></canvas>
    
    <!-- 
      Tooltip manejado por Vue, no por D3
      Seguimos el patrón híbrido: Vue controla DOM, D3 solo calcula datos
    -->
    <div 
      v-if="tooltip.visible" 
      class="tooltip"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      <div class="tooltip-content">
        <div class="tooltip-header">
          <strong>{{ tooltip.data.name }}</strong>
          <span v-if="tooltip.data.isManagerial" class="manager-badge">👑</span>
        </div>
        <div class="tooltip-position">{{ tooltip.data.position }}</div>
        <div class="tooltip-department">{{ tooltip.data.department }}</div>
        <div v-if="tooltip.data.jobFunction" class="tooltip-function">
          {{ tooltip.data.jobFunction.function }}
        </div>
        <div v-if="tooltip.data.headcount" class="tooltip-headcount">
          <div class="headcount-row">
            <span class="headcount-label">Team:</span>
            <span class="headcount-values">
              <span class="active">{{ tooltip.data.headcount.active }} active</span>
              <span v-if="tooltip.data.headcount.inactive > 0" class="inactive">{{ tooltip.data.headcount.inactive }} inactive</span>
              <span v-if="tooltip.data.headcount.open > 0" class="open">{{ tooltip.data.headcount.open }} open</span>
            </span>
          </div>
          <div class="headcount-total">Total: {{ tooltip.data.headcount.total }}</div>
        </div>
        <div class="tooltip-level">Level {{ tooltip.data.level }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, nextTick } from 'vue';
import * as d3 from 'd3';
import { generateOrganizationalChart } from '../services/userService';

// Variables reactivas de Vue - el framework maneja el estado, no D3
const canvasRef = ref(null);
const expandAll = ref(false);
const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  data: {}
});

// Variables globales para el canvas y contexto de renderizado
let canvas, ctx;
let rootGlobal, tree;
let transform = { x: 0, y: 0, k: 1 }; // Estado de zoom/pan manual
let isDragging = false;
let lastMousePos = { x: 0, y: 0 };
let animationId = null;
let resizeObserver = null;

// OPTIMIZACIÓN CLAVE: Configuración centralizada para evitar recálculos
const ANIMATION_DURATION = 300;
const NODE_CACHE = new Map(); // Cache para evitar recrear nodos
const RENDER_THROTTLE_MS = 16; // Throttling para smooth 60fps

// Paleta de colores predefinida - evita generar colores dinámicamente
const BRANCH_COLORS = [
  '#e74c3c', // rojo
  '#f39c12', // naranja
  '#f1c40f', // amarillo
  '#2ecc71', // verde
  '#1abc9c', // turquesa
  '#3498db', // azul
  '#9b59b6', // violeta
  '#e67e22', // naranja oscuro
  '#16a085', // verde azulado
  '#34495e', // azul oscuro
  '#fd79a8', // rosa
  '#00b894', // verde lima
];

// OPTIMIZACIÓN: Configuración estática evita recálculos en cada render
const CHART_CONFIG = {
  cardWidth: 120,
  cardHeight: 40,
  cardRadius: 6,
  baseRadius: 800,
  radiusMultiplier: 100,
  maxRadius: 15000,
  strokeWidth: 1.5,
  fontSize: 9,
  smallFontSize: 7,
  colors: {
    background: '#333',
    cardFill: '#333',
    cardStroke: '#1D8837',
    textFill: '#FFF',
    linkStroke: '#333',
    hoverFill: '#333',
    // Paleta jerárquica precalculada
    hierarchyColors: [
      '#1D8837', // Nivel 0 (CEO)
      '#2E7D32', // Nivel 1
      '#388E3C', // Nivel 2
      '#43A047', // Nivel 3
      '#4CAF50', // Nivel 4
      '#66BB6A', // Nivel 5
      '#81C784', // Nivel 6
      '#A5D6A7', // Nivel 7
      '#C8E6C9', // Nivel 8
      '#E8F5E9'  // Nivel 9
    ]
  }
};

/**
 * Construye la jerarquía usando D3 SOLO como utilidad de cálculo
 * No manipula DOM - solo genera estructura de datos
 * Esto es clave para la performance: D3 solo calcula, Vue renderiza
 */
function buildHierarchy() {
  const orgChart = generateOrganizationalChart();
  const root = d3.hierarchy(orgChart); // D3 solo para estructurar datos

  // Asignar color a cada rama principal y sus descendientes
  // Precalculamos esto una sola vez al inicio
  if (root.children) {
    root.children.forEach((child, idx) => {
      const branchColor = BRANCH_COLORS[idx % BRANCH_COLORS.length];
      assignBranchColor(child, branchColor);
    });
  }

  // Pre-procesamos todos los nodos para evitar cálculos posteriores
  root.each(node => {
    if (!node.data.id) {
      node.data.id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    node.data.department = node.children ? node.data.name : 
                          (node.parent ? node.parent.data.name : node.data.name);
    // Inicializamos posiciones para animaciones suaves
    node.x0 = node.x || 0;
    node.y0 = node.y || 0;
  });

  return root;
}

/**
 * Asigna colores recursivamente - optimizado para una sola pasada
 */
function assignBranchColor(node, color) {
  node.data.branchColor = color;
  if (node.children) {
    node.children.forEach(child => assignBranchColor(child, color));
  }
  if (node._children) {
    node._children.forEach(child => assignBranchColor(child, color));
  }
}

/**
 * Funciones de colapso/expansión - puro manejo de datos
 * No toca el DOM, solo reestructura datos
 */
function collapse(d) {
  if (d.children) {
    d._children = d.children;
    d._children.forEach(collapse);
    d.children = null;
  }
}

function expand(d) {
  if (d._children) {
    d.children = d._children;
    d.children.forEach(expand);
    d._children = null;
  }
}

/**
 * Toggle masivo optimizado - una sola actualización del chart
 */
function toggleAllNodes(expandFlag) {
  if (expandFlag) {
    rootGlobal.each(d => expand(d));
  } else {
    rootGlobal.children?.forEach(collapse);
  }
  updateChart(rootGlobal, true);
}

/**
 * Cálculo de posición radial optimizado
 * Factor de dispersión dinámico según profundidad
 */
function radialPoint(x, y, depth = 0) {
  const spreadFactor = 1 + (depth * 0.2);
  return [
    y * Math.cos(x - Math.PI / 2) * spreadFactor, 
    y * Math.sin(x - Math.PI / 2) * spreadFactor
  ];
}

/**
 * OPTIMIZACIÓN CRÍTICA: Canvas clearing optimizado
 * Una sola operación de clear + setup de contexto
 */
function clearCanvas() {
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  
  // Setup del contexto una sola vez por frame
  ctx.save();
  ctx.translate(width / 2 + transform.x, height / 2 + transform.y);
  ctx.scale(transform.k, transform.k);
}

/**
 * Renderizado de links usando Path2D para máxima performance
 * Path2D es mucho más rápido que dibujar stroke por stroke
 */
function renderLinks(links) {
  ctx.strokeStyle = CHART_CONFIG.colors.linkStroke;
  ctx.lineWidth = CHART_CONFIG.strokeWidth;
  ctx.lineCap = 'round';

  // D3 solo para generar path data, no manipula DOM
  const linkGenerator = d3.linkRadial()
    .angle(d => d.x)
    .radius(d => d.y * (1 + (d.depth * 0.2)));

  // Batch rendering para mejor performance
  links.forEach(link => {
    const pathData = linkGenerator(link);
    const path = new Path2D(pathData);
    ctx.stroke(path);
  });
}

/**
 * RENDER OPTIMIZADO DE NODOS
 * Canvas permite operaciones de dibujo ultra-rápidas
 * Sin manipulación DOM = sin reflow/repaint
 */
function renderNode(node, isHovered = false) {
  const [x, y] = radialPoint(node.x, node.y, node.depth);
  const { cardWidth, cardHeight, cardRadius } = CHART_CONFIG;
  
  // Una sola transformación por nodo
  ctx.save();
  ctx.translate(x, y);

  // Path2D para formas complejas - mucho más rápido
  const cardPath = new Path2D();
  cardPath.roundRect(
    -cardWidth / 2, 
    -cardHeight / 2, 
    cardWidth, 
    cardHeight, 
    cardRadius
  );

  // Color precalculado según rama y profundidad
  let fillColor = node.data.branchColor || CHART_CONFIG.colors.hierarchyColors[Math.min(node.depth, CHART_CONFIG.colors.hierarchyColors.length - 1)];
  
  // Variación de luminosidad cacheable
  if (!isHovered && node.depth > 1 && node.data.branchColor) {
    fillColor = shadeColor(node.data.branchColor, node.depth * 8);
  }
  if (isHovered) fillColor = CHART_CONFIG.colors.hoverFill;

  // Operaciones de dibujo agrupadas para minimizar state changes
  ctx.fillStyle = fillColor;
  ctx.fill(cardPath);

  ctx.strokeStyle = CHART_CONFIG.colors.cardStroke;
  ctx.lineWidth = 1.5;
  ctx.stroke(cardPath);

  // Shadow una sola vez
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  // Cálculo de luminancia para contraste de texto
  const luminance = (0.299 * parseInt(fillColor.slice(1,3), 16) + 
                    0.587 * parseInt(fillColor.slice(3,5), 16) + 
                    0.114 * parseInt(fillColor.slice(5,7), 16)) / 255;
  
  const textColor = luminance > 0.5 ? '#000000' : '#FFFFFF';
  
  // Renderizado de texto optimizado - truncado inteligente
  ctx.fillStyle = textColor;
  ctx.font = `bold ${CHART_CONFIG.fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Truncado eficiente usando binary search
  let name = node.data.name;
  const nameMaxWidth = cardWidth - 16;
  const nameTextWidth = ctx.measureText(name).width;
  if (nameTextWidth > nameMaxWidth) {
    let start = 0, end = name.length;
    while (start < end) {
      const mid = Math.floor((start + end) / 2);
      const truncated = name.slice(0, mid) + '...';
      if (ctx.measureText(truncated).width <= nameMaxWidth) {
        start = mid + 1;
      } else {
        end = mid;
      }
    }
    name = name.slice(0, start - 1) + '...';
  }
  
  ctx.fillText(name, 0, -8);
  
  // Texto de posición con mismo patrón optimizado
  ctx.font = `${CHART_CONFIG.smallFontSize}px sans-serif`;
  ctx.fillStyle = textColor;
  let position = node.data.position || 'Employee';
  const posMaxWidth = cardWidth - 16;
  const posTextWidth = ctx.measureText(position).width;
  if (posTextWidth > posMaxWidth) {
    let start = 0, end = position.length;
    while (start < end) {
      const mid = Math.floor((start + end) / 2);
      const truncated = position.slice(0, mid) + '...';
      if (ctx.measureText(truncated).width <= posMaxWidth) {
        start = mid + 1;
      } else {
        end = mid;
      }
    }
    position = position.slice(0, start - 1) + '...';
  }
  
  ctx.fillText(position, 0, 6);
  
  // Indicadores adicionales sin overhead DOM
  if (node.data.headcount && node.data.headcount.total > 1) {
    ctx.font = `${CHART_CONFIG.smallFontSize - 1}px sans-serif`;
    ctx.fillStyle = textColor;
    const headcountText = `(${node.data.headcount.active}/${node.data.headcount.total})`;
    ctx.fillText(headcountText, 0, 14);
  }
  
  // Indicador de expansión/colapso
  if (node._children || node.children) {
    ctx.beginPath();
    ctx.arc(cardWidth / 2 - 6, -cardHeight / 2 + 6, 3, 0, 2 * Math.PI);
    ctx.fillStyle = node.children ? '#10b981' : '#6b7280';
    ctx.fill();
    
    ctx.font = `bold ${CHART_CONFIG.smallFontSize}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.children ? '-' : '+', cardWidth / 2 - 6, -cardHeight / 2 + 6);
  }

  // Indicador gerencial
  if (node.data.isManagerial) {
    ctx.beginPath();
    ctx.arc(-cardWidth / 2 + 6, -cardHeight / 2 + 6, 2, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
  }

  ctx.restore();
}

/**
 * FUNCIÓN DE RENDER PRINCIPAL
 * Canvas permite renderizar toda la visualización en una pasada sin DOM
 * Esto es infinitamente más rápido que SVG con miles de elementos
 */
function render(hoveredNode = null) {
  if (!ctx || !rootGlobal) return;

  clearCanvas(); // Una sola operación de limpieza

  const nodes = rootGlobal.descendants();
  const links = rootGlobal.links();

  // Batch rendering: primero links, después nodos
  renderLinks(links);

  // Render de todos los nodos en una sola pasada
  nodes.forEach(node => {
    renderNode(node, node === hoveredNode);
  });

  ctx.restore();
}

/**
 * Update del chart usando D3 solo para cálculos matemáticos
 * No manipula DOM - solo recalcula posiciones
 */
function updateChart(source, autoZoom = false) {
  const nodes = rootGlobal.descendants();
  const nodeCount = nodes.length;
  const maxDepth = d3.max(nodes, d => d.depth);
  
  // Cálculo dinámico de radio basado en cantidad de nodos
  const dynamicRadius = Math.min(
    CHART_CONFIG.maxRadius, 
    CHART_CONFIG.baseRadius + (nodeCount * CHART_CONFIG.radiusMultiplier) + (maxDepth * 250)
  );

  // D3 cluster solo para calcular layout, no para renderizar
  tree = d3.cluster().size([2 * Math.PI, dynamicRadius - 25]);
  tree(rootGlobal);

  // Auto-zoom calculado, no animado por D3
  if (autoZoom && canvas) {
    const scale = Math.min(canvas.width, canvas.height) / (dynamicRadius * 2.2);
    transform.k = Math.max(0.1, Math.min(2, scale));
    transform.x = 0;
    transform.y = 0;
  }

  // Preparar datos para animación custom
  nodes.forEach(d => {
    d.x0 = d.x0 || d.x;
    d.y0 = d.y0 || d.y;
  });

  animateNodes(nodes, source);
}

/**
 * ANIMACIÓN CUSTOM SIN D3 TRANSITIONS
 * Como dice el libro: mejor usar requestAnimationFrame que D3 transitions
 * Más control, mejor performance, sin overhead de D3
 */
function animateNodes(nodes, source) {
  const startTime = performance.now();
  
  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
    
    // Easing personalizado más eficiente que D3
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    
    // Interpolación manual de posiciones
    nodes.forEach(node => {
      const startX = node.x0;
      const startY = node.y0;
      const endX = node.x;
      const endY = node.y;
      
      node.currentX = startX + (endX - startX) * easeProgress;
      node.currentY = startY + (endY - startY) * easeProgress;
    });
    
    // Actualizar posiciones para render
    nodes.forEach(node => {
      node.x = node.currentX;
      node.y = node.currentY;
    });
    
    render(); // Re-render con Canvas (súper rápido)
    
    if (progress < 1) {
      animationId = requestAnimationFrame(animate);
    } else {
      // Finalizar animación
      nodes.forEach(node => {
        node.x0 = node.x;
        node.y0 = node.y;
      });
    }
  }
  
  // Cancelar animación previa para evitar conflictos
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  
  animationId = requestAnimationFrame(animate);
}

/**
 * Conversión de coordenadas pantalla -> chart optimizada
 */
function screenToChart(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left - canvas.width / 2 - transform.x) / transform.k;
  const y = (clientY - rect.top - canvas.height / 2 - transform.y) / transform.k;
  return { x, y };
}

/**
 * Hit detection optimizado - búsqueda lineal eficiente
 * En Canvas no tenemos eventos DOM por elemento
 */
function getNodeAtPosition(x, y) {
  const nodes = rootGlobal.descendants();
  const { cardWidth, cardHeight } = CHART_CONFIG;
  
  return nodes.find(node => {
    const [nodeX, nodeY] = radialPoint(node.x, node.y, node.depth);
    return Math.abs(x - nodeX) <= cardWidth / 2 && 
           Math.abs(y - nodeY) <= cardHeight / 2;
  });
}

/**
 * MANEJO DE EVENTOS OPTIMIZADO
 * Un solo event listener en el canvas, no uno por elemento
 * Esto es MUCHÍSIMO más performante que SVG con listeners individuales
 */
function handleMouseDown(event) {
  isDragging = true;
  lastMousePos = { x: event.clientX, y: event.clientY };
  canvas.style.cursor = 'grabbing';
}

function handleMouseMove(event) {
  if (isDragging) {
    // Pan manual sin D3 - más directo y rápido
    const dx = event.clientX - lastMousePos.x;
    const dy = event.clientY - lastMousePos.y;
    
    transform.x += dx;
    transform.y += dy;
    
    lastMousePos = { x: event.clientX, y: event.clientY };
    render(); // Re-render inmediato
  } else {
    // Hover detection manual
    const chartCoords = screenToChart(event.clientX, event.clientY);
    const hoveredNode = getNodeAtPosition(chartCoords.x, chartCoords.y);
    
    if (hoveredNode) {
      canvas.style.cursor = 'pointer';
      showTooltip(event.clientX, event.clientY, hoveredNode.data);
      render(hoveredNode); // Re-render con hover
    } else {
      canvas.style.cursor = 'grab';
      hideTooltip();
      render();
    }
  }
}

function handleMouseUp() {
  isDragging = false;
  canvas.style.cursor = 'grab';
}

/**
 * Zoom optimizado con transform manual
 * Sin D3 zoom behavior - más control directo
 */
function handleWheel(event) {
  event.preventDefault();
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;
  
  const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
  const newScale = Math.max(0.01, Math.min(100, transform.k * scaleFactor));
  
  // Cálculo de zoom hacia punto del mouse
  const scaleChange = newScale / transform.k;
  transform.x = mouseX - (mouseX - transform.x) * scaleChange - canvas.width / 2;
  transform.y = mouseY - (mouseY - transform.y) * scaleChange - canvas.height / 2;
  transform.x += canvas.width / 2;
  transform.y += canvas.height / 2;
  
  transform.k = newScale;
  render(); // Re-render inmediato
}


function handleClick(event) {
  const chartCoords = screenToChart(event.clientX, event.clientY);
  const clickedNode = getNodeAtPosition(chartCoords.x, chartCoords.y);
  
  if (clickedNode && (clickedNode.children || clickedNode._children)) {
    // Toggle collapse/expand - solo datos, no DOM
    if (clickedNode.children) {
      clickedNode._children = clickedNode.children;
      clickedNode.children = null;
    } else {
      clickedNode.children = clickedNode._children;
      clickedNode._children = null;
    }
    updateChart(clickedNode);
  }
}

/**
 * TOOLTIP MANEJADO POR VUE
 * Como dice el libro: dejamos que Vue maneje las transiciones CSS
 * En lugar de D3 transitions, usamos CSS transitions que son más eficientes
 */
function showTooltip(x, y, data) {
  tooltip.value = {
    visible: true,
    x: x + 10,
    y: y - 10,
    data: data
  };
}

function hideTooltip() {
  tooltip.value.visible = false;
}

/**
 * Funciones de control que usan el estado reactivo de Vue
 */
function toggleExpandAll() {
  expandAll.value = !expandAll.value;
  toggleAllNodes(expandAll.value);
}

function resetZoom() {
  transform = { x: 0, y: 0, k: 1 };
  updateChart(rootGlobal, true);
}

/**
 * RESIZE OPTIMIZADO
 * ResizeObserver + canvas resizing manual para máxima performance
 */
function resizeCanvas() {
  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();
  
  // HiDPI support para pantallas de alta resolución
  const devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  
  ctx.scale(devicePixelRatio, devicePixelRatio);
  
  render();
}

/**
 * Utilidad para variación de color - precalculada cuando sea posible
 */
function shadeColor(color, percent) {
  let R = parseInt(color.substring(1,3),16);
  let G = parseInt(color.substring(3,5),16);
  let B = parseInt(color.substring(5,7),16);
  R = Math.min(255, Math.floor(R + (255 - R) * percent / 100));
  G = Math.min(255, Math.floor(G + (255 - G) * percent / 100));
  B = Math.min(255, Math.floor(B + (255 - B) * percent / 100));
  return `#${R.toString(16).padStart(2,'0')}${G.toString(16).padStart(2,'0')}${B.toString(16).padStart(2,'0')}`;
}

/**
 * LIFECYCLE DE VUE - ENFOQUE HÍBRIDO PERFECTO
 * Vue maneja el ciclo de vida, D3 solo como utilidad
 */
onMounted(async () => {
  await nextTick();
  
  canvas = canvasRef.value;
  ctx = canvas.getContext('2d');
  
  // ResizeObserver para performance en resize
  resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(canvas.parentElement);
  
  resizeCanvas();
  
  // D3 solo para estructurar datos iniciales
  const root = buildHierarchy();
  rootGlobal = root;
  root.x0 = Math.PI;
  root.y0 = 0;
  
  // Colapsar nodos inicialmente
  root.children?.forEach(collapse);
  
  updateChart(root, true);
  
  canvas.style.cursor = 'grab';
});

onUnmounted(() => {
  // Cleanup manual para evitar memory leaks
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});
</script>

<style scoped>
/* 
  CSS TRANSITIONS EN LUGAR DE D3 TRANSITIONS
  Como recomienda el libro: usar CSS para transiciones simples
  Es más performante y simple que D3 transitions
*/
.org-chart-container {
  width: 100%;
  height: calc(100vh - 66px);
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #333 0%, #333 100%);
  position: relative;
  overflow: hidden;
}

.controls {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  z-index: 10;
}

.control-button {
  padding: 10px 20px;
  background: linear-gradient(135deg, #1D8837 0%, #1D8837 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  /* CSS TRANSITION - más eficiente que D3 segun el libro */
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(74, 144, 226, 0.2);
}

.control-button:hover {
  background: linear-gradient(135deg, #1D8837 0%, #1D8837 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(74, 144, 226, 0.3);
}

.control-button:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(74, 144, 226, 0.2);
}

.chart-canvas {
  flex: 1;
  border-radius: 12px;
  margin: 0;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  background: #E2E1DC;
  width: 100vw;
  height: 100%;
  display: block;
}

/* TOOLTIP CON TRANSICIÓN CSS - NO D3 */
.tooltip {
  position: fixed;
  pointer-events: none;
  z-index: 1000;
  /* CSS transition más eficiente que D3 transition */
  transition: opacity 0.2s ease;
}

.tooltip-content {
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 3px 5px;
  border-radius: 3px;
  font-size: 8px;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.tooltip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.manager-badge {
  background-color: #ffd700;
  padding: 2px 4px;
  border-radius: 4px;
  font-size: 8px;
}

.tooltip-position {
  font-size: 6px;
  opacity: 0.8;
  margin-top: 1px;
}

.tooltip-department {
  font-size: 6px;
  opacity: 0.8;
  margin-top: 1px;
}

.tooltip-function {
  font-size: 6px;
  opacity: 0.8;
  margin-top: 1px;
}

.tooltip-headcount {
  margin-top: 1px;
}

.headcount-row {
  display: flex;
  align-items: center;
}

.headcount-label {
  font-size: 6px;
  opacity: 0.8;
  margin-right: 4px;
}

.headcount-values {
  display: flex;
  align-items: center;
}

.active {
  font-size: 6px;
  opacity: 0.8;
  margin-right: 4px;
}

.inactive {
  font-size: 6px;
  opacity: 0.8;
  margin-right: 4px;
}

.open {
  font-size: 6px;
  opacity: 0.8;
  margin-right: 4px;
}

.headcount-total {
  font-size: 6px;
  opacity: 0.8;
  margin-top: 1px;
}

.tooltip-level {
  font-size: 6px;
  opacity: 0.8;
  margin-top: 1px;
}

/* Optimización de rendering para canvas */
.chart-canvas {
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}
</style>