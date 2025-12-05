// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";
import "./style.css";

// --- 基本 UI 布局 ---

const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
controlPanelDiv.textContent = "World of Bits – D3.c (persistence)";
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

// 移动按钮容器
const moveButtonsDiv = document.createElement("div");
moveButtonsDiv.id = "moveButtons";
controlPanelDiv.append(moveButtonsDiv);

// --- 地图初始化（教室附近，但网格概念上覆盖整个地球） ---

const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);
const GAMEPLAY_ZOOM_LEVEL = 19;

const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

const playerMarker = leaflet.marker(CLASSROOM_LATLNG).addTo(map);
playerMarker.bindTooltip("You are here", { permanent: true, direction: "top" });

// --- 玩家状态 ---

type PlayerState = {
  lat: number;
  lng: number;
  tokenInHand: number | null;
};

const player: PlayerState = {
  lat: CLASSROOM_LATLNG.lat,
  lng: CLASSROOM_LATLNG.lng,
  tokenInHand: null,
};

function updateStatusPanel() {
  const handText = player.tokenInHand === null
    ? "In hand: (empty)"
    : `In hand: ${player.tokenInHand}`;

  const posText = ` | Position: ${player.lat.toFixed(5)}, ${
    player.lng.toFixed(5)
  }`;

  statusPanelDiv.textContent = handText + posText;
}

// --- 网格 & Token 状态 ---

// 概念上：整个地球被划成 CELL_SIZE_DEG × CELL_SIZE_DEG 的格子，原点是 (0, 0) Null Island
const CELL_SIZE_DEG = 0.0001;

type CellIndex = {
  row: number; // 纬度方向索引
  col: number; // 经度方向索引
};

// D3.c：CellState 专门用来描述“屏幕上的对象”，不直接存 token 数值
type CellState = {
  index: CellIndex;
  rect: leaflet.Rectangle;
  marker?: leaflet.Marker;
};

// 当前视口内有哪些 cellId
let currentlyVisibleCellIds = new Set<string>();

// 只保存**当前可见**格子的可视状态（rect/marker）
const cellStateById = new Map<string, CellState>();

function cellId(cell: CellIndex): string {
  return `${cell.row},${cell.col}`;
}

const TOKEN_SPAWN_PROBABILITY = 0.3;
const TOKEN_SEED_PREFIX = "world-of-bits-d3";

// 用 luck 决定这个 cell 的初始 token
function initialTokenValueForCell(cell: CellIndex): number | null {
  const id = cellId(cell);
  const r = luck(`${TOKEN_SEED_PREFIX}:${id}`);
  return r < TOKEN_SPAWN_PROBABILITY ? 1 : null;
}

function _latLngToCellIndex(lat: number, lng: number): CellIndex {
  const row = Math.floor(lat / CELL_SIZE_DEG);
  const col = Math.floor(lng / CELL_SIZE_DEG);
  return { row, col };
}

function cellIndexToBounds(cell: CellIndex): leaflet.LatLngBounds {
  const minLat = cell.row * CELL_SIZE_DEG;
  const minLng = cell.col * CELL_SIZE_DEG;
  const maxLat = minLat + CELL_SIZE_DEG;
  const maxLng = minLng + CELL_SIZE_DEG;
  return leaflet.latLngBounds([minLat, minLng], [maxLat, maxLng]);
}

// --- D3.c：持久化 Map（只存被“修改过”的格子），Flyweight + Memento 核心 ---

// key: cellId, value: 当前 token（包括 null）
const modifiedCellTokens = new Map<string, number | null>();

function getCellTokenValue(index: CellIndex): number | null {
  const id = cellId(index);
  if (modifiedCellTokens.has(id)) {
    return modifiedCellTokens.get(id)!;
  }
  // 没有被改动过 -> 用初始值
  return initialTokenValueForCell(index);
}

function setCellTokenValue(index: CellIndex, newValue: number | null): void {
  const id = cellId(index);
  const base = initialTokenValueForCell(index);

  // 如果新的值跟“本来就该有的初始值”一样，就不占内存
  if (newValue === base) {
    modifiedCellTokens.delete(id);
  } else {
    modifiedCellTokens.set(id, newValue);
  }
}

// --- 交互距离（用玩家位置 vs 格子中心算距离） ---

const INTERACTION_RADIUS_IN_CELLS = 3;

function canInteractWithCell(cell: CellIndex): boolean {
  const bounds = cellIndexToBounds(cell);
  const center = bounds.getCenter();

  const dLatInCells = (center.lat - player.lat) / CELL_SIZE_DEG;
  const dLngInCells = (center.lng - player.lng) / CELL_SIZE_DEG;

  const chebyshevDistance = Math.max(
    Math.abs(dLatInCells),
    Math.abs(dLngInCells),
  );

  return chebyshevDistance <= INTERACTION_RADIUS_IN_CELLS;
}

// --- Marker 更新（从 Map 里取值，而不是从 CellState 里取） ---

function updateCellMarker(state: CellState) {
  const bounds = cellIndexToBounds(state.index);
  const center = bounds.getCenter();

  const tokenValue = getCellTokenValue(state.index);

  if (tokenValue === null) {
    if (state.marker) {
      map.removeLayer(state.marker);
      delete state.marker;
    }
    return;
  }

  const icon = leaflet.divIcon({
    className: "token-icon",
    html: `<span>${tokenValue}</span>`,
    iconSize: [24, 24],
  });

  if (state.marker) {
    state.marker.setIcon(icon);
    state.marker.setLatLng(center);
  } else {
    state.marker = leaflet.marker(center, { icon }).addTo(map);
    // 点击数字本身也能触发交互
    state.marker.on("click", () => handleCellClick(state));
  }
}

// --- 胜利判定（D3.b/D3.c 都用更高目标值） ---

const WIN_VALUE = 32;

function checkWinCondition(cellValue?: number | null) {
  const handValue = player.tokenInHand ?? 0;
  const cellVal = cellValue ?? 0;
  const maxValue = Math.max(handValue, cellVal);

  if (maxValue >= WIN_VALUE) {
    alert(`You win! You crafted a token of value ${maxValue}.`);
  }
}

// --- 点击逻辑（通过 get/set 读写 token 值） ---

function handleCellClick(state: CellState) {
  if (!canInteractWithCell(state.index)) {
    alert("This cell is too far away to interact with.");
    return;
  }

  const cellHas = getCellTokenValue(state.index);
  const handHas = player.tokenInHand;

  // 拾取：手空 & 格子有东西
  if (handHas === null && cellHas !== null) {
    player.tokenInHand = cellHas;
    setCellTokenValue(state.index, null);
    updateCellMarker(state);
    updateStatusPanel();
    // 拾取本身不会产生更大的 token，这里可以不检查胜利，留着也无所谓
    return;
  }

  // 放下：手里有 & 格子空
  if (handHas !== null && cellHas === null) {
    setCellTokenValue(state.index, handHas);
    player.tokenInHand = null;
    updateCellMarker(state);
    updateStatusPanel();
    checkWinCondition(handHas);
    return;
  }

  // 合成：手里有 & 格子有 & 数值相同
  if (handHas !== null && cellHas !== null && handHas === cellHas) {
    const newValue = cellHas * 2;
    setCellTokenValue(state.index, newValue);
    player.tokenInHand = null;
    updateCellMarker(state);
    updateStatusPanel();
    checkWinCondition(newValue);
    return;
  }

  alert("Cannot interact with this cell in that way.");
}

// --- 视口驱动的格子渲染（显示层依然是重建式） ---

function renderVisibleCells() {
  const bounds = map.getBounds();
  const southWest = bounds.getSouthWest();
  const northEast = bounds.getNorthEast();

  const minRow = Math.floor(southWest.lat / CELL_SIZE_DEG);
  const maxRow = Math.floor(northEast.lat / CELL_SIZE_DEG);
  const minCol = Math.floor(southWest.lng / CELL_SIZE_DEG);
  const maxCol = Math.floor(northEast.lng / CELL_SIZE_DEG);

  const nextVisibleCellIds = new Set<string>();

  // 生成 / 更新视口内的格子
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const cell: CellIndex = { row, col };
      const id = cellId(cell);
      nextVisibleCellIds.add(id);

      // 已经在视口里了：保留当前可视状态
      if (currentlyVisibleCellIds.has(id)) continue;

      const cellBounds = cellIndexToBounds(cell);
      const rect = leaflet.rectangle(cellBounds, {
        weight: 1,
        color: "#666",
        fillOpacity: 0,
      }).addTo(map);

      const state: CellState = { index: cell, rect };

      rect.on("click", () => handleCellClick(state));

      cellStateById.set(id, state);
      updateCellMarker(state);
    }
  }

  // despawn：离开视口的格子 -> 移除图层，但不动 modifiedCellTokens
  for (const id of currentlyVisibleCellIds) {
    if (!nextVisibleCellIds.has(id)) {
      const state = cellStateById.get(id);
      if (state) {
        if (state.marker) {
          map.removeLayer(state.marker);
        }
        map.removeLayer(state.rect);
        cellStateById.delete(id);
      }
    }
  }

  currentlyVisibleCellIds = nextVisibleCellIds;
}

// 初次渲染
renderVisibleCells();
updateStatusPanel();

// 地图移动结束时，刷新视口格子
map.on("moveend", () => {
  renderVisibleCells();
});

// --- 玩家移动按钮（按格子步长移动） ---

function movePlayerBy(deltaRow: number, deltaCol: number) {
  // row 增加 -> 纬度增加；col 增加 -> 经度增加
  player.lat += deltaRow * CELL_SIZE_DEG;
  player.lng += deltaCol * CELL_SIZE_DEG;

  playerMarker.setLatLng([player.lat, player.lng]);
  // 让地图跟随玩家移动
  map.panTo([player.lat, player.lng]);

  updateStatusPanel();
  // panTo 会触发 moveend -> renderVisibleCells
}

// --- MovementDriver 接口 + 按钮实现（D3.d：Facade） ---

type MovementDriver = {
  start(): void;
  stop(): void;
};

class ButtonMovementDriver implements MovementDriver {
  constructor(private readonly container: HTMLElement) {}

  private buttons: HTMLButtonElement[] = [];
  private active = false;

  start(): void {
    if (this.active) return;
    this.active = true;

    this.createButton("Move N", +1, 0); // row+1 (纬度增大)
    this.createButton("Move S", -1, 0); // row-1
    this.createButton("Move E", 0, +1); // col+1 (经度增大)
    this.createButton("Move W", 0, -1); // col-1
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;

    for (const btn of this.buttons) {
      this.container.removeChild(btn);
    }
    this.buttons = [];
  }

  private createButton(label: string, deltaRow: number, deltaCol: number) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.addEventListener("click", () => movePlayerBy(deltaRow, deltaCol));
    this.container.append(btn);
    this.buttons.push(btn);
  }
}

// 当前使用的移动驱动（先只用按钮版，之后会加入 geolocation 版）
const movementDriver: MovementDriver = new ButtonMovementDriver(
  moveButtonsDiv,
);
movementDriver.start();
