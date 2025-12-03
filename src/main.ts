// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";
import "./style.css";

const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
controlPanelDiv.textContent = "World of Bits – D3.b (globe-spanning)";
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

// --- 教室位置 & 地图初始化 ---

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
  statusPanelDiv.textContent = player.tokenInHand === null
    ? "In hand: (empty)"
    : `In hand: ${player.tokenInHand}`;
}

// --- Grid & token state ---

const CELL_SIZE_DEG = 0.0001;

// 纯索引（地球网格坐标）
type CellIndex = {
  row: number;
  col: number;
};

// 包含在屏幕上的渲染信息
type CellState = {
  index: CellIndex;
  tokenValue: number | null;
  marker?: leaflet.Marker;
  rect?: leaflet.Rectangle;
};

const cellStateById = new Map<string, CellState>();

function cellId(cell: CellIndex): string {
  return `${cell.row},${cell.col}`;
}

const TOKEN_SPAWN_PROBABILITY = 0.3;
const TOKEN_SEED_PREFIX = "world-of-bits-d3a";

function initialTokenValueForCell(cell: CellIndex): number | null {
  const id = cellId(cell);
  const r = luck(`${TOKEN_SEED_PREFIX}:${id}`);
  return r < TOKEN_SPAWN_PROBABILITY ? 1 : null;
}

function latLngToCellIndex(lat: number, lng: number): CellIndex {
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

// --- 距离 & 交互限制 ---

function cellDistance(a: CellIndex, b: CellIndex): number {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return Math.max(dr, dc);
}

const INTERACTION_RADIUS_IN_CELLS = 3;

function canInteractWithCell(cell: CellIndex): boolean {
  const playerCell = latLngToCellIndex(player.lat, player.lng);
  return cellDistance(playerCell, cell) <= INTERACTION_RADIUS_IN_CELLS;
}

// --- Marker 更新 ---

function updateCellMarker(state: CellState) {
  const bounds = cellIndexToBounds(state.index);
  const center = bounds.getCenter();

  if (state.tokenValue === null) {
    if (state.marker) {
      map.removeLayer(state.marker);
      delete state.marker;
    }
    return;
  }

  const icon = leaflet.divIcon({
    className: "token-icon",
    html: `<span>${state.tokenValue}</span>`,
    iconSize: [24, 24],
  });

  if (state.marker) {
    state.marker.setIcon(icon);
    state.marker.setLatLng(center);
  } else {
    state.marker = leaflet.marker(center, { icon }).addTo(map);
    // ⬇⬇⬇ 新增：点击数字本身也能触发交互
    state.marker.on("click", () => handleCellClick(state));
  }
}

// --- 胜利条件 ---

const WIN_VALUE = 32; // D3.b：提高一点门槛

function checkWinCondition() {
  // 手牌达标
  if (player.tokenInHand !== null && player.tokenInHand >= WIN_VALUE) {
    alert(`You win! You crafted a token of value ${player.tokenInHand}.`);
    return;
  }

  // 地图上任何一个 cell 达标
  for (const state of cellStateById.values()) {
    if (state.tokenValue !== null && state.tokenValue >= WIN_VALUE) {
      alert(`You win! A cell reached value ${state.tokenValue}.`);
      return;
    }
  }
}

// --- 点击逻辑 ---

function handleCellClick(state: CellState) {
  if (!canInteractWithCell(state.index)) {
    alert("This cell is too far away to interact with.");
    return;
  }

  const cellHas = state.tokenValue;
  const handHas = player.tokenInHand;

  if (handHas === null && cellHas !== null) {
    // 拾取
    player.tokenInHand = cellHas;
    state.tokenValue = null;
    updateCellMarker(state);
    updateStatusPanel();
    checkWinCondition();
    return;
  }

  if (handHas !== null && cellHas === null) {
    // 放下
    state.tokenValue = handHas;
    player.tokenInHand = null;
    updateCellMarker(state);
    updateStatusPanel();
    checkWinCondition();
    return;
  }

  if (handHas !== null && cellHas !== null && handHas === cellHas) {
    // 合成（结果留在格子里）
    const newValue = cellHas * 2;
    state.tokenValue = newValue;
    player.tokenInHand = null;
    updateCellMarker(state);
    updateStatusPanel();
    checkWinCondition();
    return;
  }

  alert("Cannot interact with this cell in that way.");
}

// --- 视口驱动的格子渲染（D3.b 核心） ---

function renderVisibleCells() {
  // 当前 Leaflet 视口的地理范围
  const bounds = map.getBounds();
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const west = bounds.getWest();
  const east = bounds.getEast();

  // 需要覆盖整个屏幕的 row/col 范围
  const minRow = Math.floor(south / CELL_SIZE_DEG);
  const maxRow = Math.floor(north / CELL_SIZE_DEG);
  const minCol = Math.floor(west / CELL_SIZE_DEG);
  const maxCol = Math.floor(east / CELL_SIZE_DEG);

  const nextVisible = new Set<string>();

  // 生成 / 更新当前视口中的格子
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const cell: CellIndex = { row, col };
      const id = cellId(cell);
      nextVisible.add(id);

      let state = cellStateById.get(id);

      if (!state) {
        // D3.b 要求 memoryless：每次进入视野都重新生成
        const tokenValue = initialTokenValueForCell(cell);
        state = { index: cell, tokenValue };
        cellStateById.set(id, state);
      }

      // 如果还没有矩形，就创建一个
      if (!state.rect) {
        const cellBounds = cellIndexToBounds(cell);
        const rect = leaflet.rectangle(cellBounds, {
          weight: 1,
          color: "#666",
          fillOpacity: 0,
        }).addTo(map);

        rect.on("click", () => handleCellClick(state));
        state.rect = rect;
      }

      // 确保 token 显示正确
      updateCellMarker(state);
    }
  }

  // 把离开视口的格子全部 despawn（memoryless）
  for (const [id, state] of cellStateById.entries()) {
    if (!nextVisible.has(id)) {
      if (state.rect) {
        map.removeLayer(state.rect);
      }
      if (state.marker) {
        map.removeLayer(state.marker);
      }
      cellStateById.delete(id);
    }
  }
}

// --- 玩家移动按钮（以格子大小为步长） ---

function addMovementButtons() {
  const makeButton = (label: string, onClick: () => void) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    controlPanelDiv.append(" ");
    controlPanelDiv.append(btn);
  };

  // 北：纬度 +CELL_SIZE_DEG
  makeButton("Move N", () => {
    player.lat += CELL_SIZE_DEG;
    playerMarker.setLatLng([player.lat, player.lng]);
    renderVisibleCells();
    updateStatusPanel();
  });

  // 南：纬度 -CELL_SIZE_DEG
  makeButton("Move S", () => {
    player.lat -= CELL_SIZE_DEG;
    playerMarker.setLatLng([player.lat, player.lng]);
    renderVisibleCells();
    updateStatusPanel();
  });

  // 东：经度 +CELL_SIZE_DEG
  makeButton("Move E", () => {
    player.lng += CELL_SIZE_DEG;
    playerMarker.setLatLng([player.lat, player.lng]);
    renderVisibleCells();
    updateStatusPanel();
  });

  // 西：经度 -CELL_SIZE_DEG
  makeButton("Move W", () => {
    player.lng -= CELL_SIZE_DEG;
    playerMarker.setLatLng([player.lat, player.lng]);
    renderVisibleCells();
    updateStatusPanel();
  });
}

// --- 地图事件：允许拖动 / 缩放时自动刷新格子 ---

map.on("moveend", () => {
  renderVisibleCells();
});

// --- 启动时初始化 ---

addMovementButtons();
renderVisibleCells();
updateStatusPanel();
