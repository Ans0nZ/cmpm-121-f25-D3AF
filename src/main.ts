// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";
import "./style.css";

// ─────────────────────────────────────
// UI 布局
// ─────────────────────────────────────

const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
controlPanelDiv.textContent = "World of Bits – D3.b (globe gameplay)";
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

// ─────────────────────────────────────
// 地图初始化（中心还是教室）
// ─────────────────────────────────────

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

// ─────────────────────────────────────
// 玩家状态
// ─────────────────────────────────────

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

// ─────────────────────────────────────
// 网格 & token 状态（地球级，锚定在 Null Island）
// ─────────────────────────────────────

const CELL_SIZE_DEG = 0.0001;

type CellIndex = {
  row: number;
  col: number;
};

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

// 对同一个 cellId，luck 的结果是固定的；despawn 后再进入视野会“重置”
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

// 教室所在的格子（主要用来作为一个参考）
const PLAYER_CELL_AT_CLASSROOM = latLngToCellIndex(
  CLASSROOM_LATLNG.lat,
  CLASSROOM_LATLNG.lng,
);

// ─────────────────────────────────────
// 交互距离
// ─────────────────────────────────────

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

// ─────────────────────────────────────
// Marker 更新
// ─────────────────────────────────────

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
  }
}

// ─────────────────────────────────────
// 点击逻辑 & 胜利条件
// ─────────────────────────────────────

const WIN_VALUE = 32; // D3.b 提高一点目标

function checkWinCondition() {
  if (player.tokenInHand !== null && player.tokenInHand >= WIN_VALUE) {
    alert(`You win! You crafted a token of value ${player.tokenInHand}.`);
  }
}

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

// ─────────────────────────────────────
// 视野驱动的格子渲染（spawn / despawn）
// ─────────────────────────────────────

function renderVisibleCells() {
  const bounds = map.getBounds();

  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const west = bounds.getWest();
  const east = bounds.getEast();

  // 计算需要覆盖视野的 row/col 范围，加一点 padding 防止边缘露白
  const padding = 1;

  const minRow = Math.floor(south / CELL_SIZE_DEG) - padding;
  const maxRow = Math.floor(north / CELL_SIZE_DEG) + padding;
  const minCol = Math.floor(west / CELL_SIZE_DEG) - padding;
  const maxCol = Math.floor(east / CELL_SIZE_DEG) + padding;

  const neededCellIds = new Set<string>();

  // 生成 / 更新当前视野内的所有 cell
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const cell: CellIndex = { row, col };
      const id = cellId(cell);
      neededCellIds.add(id);

      let state = cellStateById.get(id);
      if (!state) {
        const tokenValue = initialTokenValueForCell(cell);
        state = { index: cell, tokenValue };
        cellStateById.set(id, state);
      } else {
        // 确保 index 是最新（虽然这里基本不会变）
        state.index = cell;
      }

      const cellBounds = cellIndexToBounds(cell);

      if (!state.rect) {
        const rect = leaflet.rectangle(cellBounds, {
          weight: 1,
          color: "#666",
          fillOpacity: 0,
        }).addTo(map);

        rect.on("click", () => handleCellClick(state));
        state.rect = rect;
      } else {
        // 视野缩放时位置可能略有变化，稳妥起见更新一下
        state.rect.setBounds(cellBounds);
      }

      updateCellMarker(state);
    }
  }

  // despawn：把不再需要的 cell 从地图和内存里移除
  for (const [id, state] of cellStateById.entries()) {
    if (!neededCellIds.has(id)) {
      if (state.rect) {
        map.removeLayer(state.rect);
        delete state.rect;
      }
      if (state.marker) {
        map.removeLayer(state.marker);
        delete state.marker;
      }
      cellStateById.delete(id);
    }
  }
}

// ─────────────────────────────────────
// 玩家移动按钮（N / S / E / W）
// ─────────────────────────────────────

function movePlayer(deltaLat: number, deltaLng: number) {
  player.lat += deltaLat;
  player.lng += deltaLng;

  const newPos = leaflet.latLng(player.lat, player.lng);
  playerMarker.setLatLng(newPos);

  // 可以选择是否让地图跟着居中，这里让它跟着玩家走
  map.setView(newPos, map.getZoom());

  renderVisibleCells();
}

function addMoveButton(label: string, onClick: () => void) {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  controlPanelDiv.append(" ", btn);
}

addMoveButton("Move N", () => movePlayer(+CELL_SIZE_DEG, 0));
addMoveButton("Move S", () => movePlayer(-CELL_SIZE_DEG, 0));
addMoveButton("Move E", () => movePlayer(0, +CELL_SIZE_DEG));
addMoveButton("Move W", () => movePlayer(0, -CELL_SIZE_DEG));

// 地图被拖动 / 缩放后，重新渲染视野内的 cell
map.on("moveend", () => {
  renderVisibleCells();
});

// 初始渲染
renderVisibleCells();
updateStatusPanel();
