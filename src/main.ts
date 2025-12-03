// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";

// --- 基本布局 ---

const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
controlPanelDiv.textContent = "World of Bits – D3.a / D3.b (core mechanics)";
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
  return Math.max(dr, dc); // Chebyshev 距离：8 邻域
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
  }
}

// --- 点击 / 合成逻辑 ---

const WIN_VALUE = 16; // D3.b 之后会再提高门槛

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

// --- 视口驱动的格子渲染（D3.b）---

function renderVisibleCells() {
  // 1. 当前地图视口
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();

  // 2. 转成 cell 范围（多一圈 buffer）
  const minCell = latLngToCellIndex(sw.lat, sw.lng);
  const maxCell = latLngToCellIndex(ne.lat, ne.lng);

  const keepIds = new Set<string>();

  for (let row = minCell.row - 1; row <= maxCell.row + 1; row++) {
    for (let col = minCell.col - 1; col <= maxCell.col + 1; col++) {
      const cell: CellIndex = { row, col };
      const id = cellId(cell);
      keepIds.add(id);

      let state = cellStateById.get(id);
      if (!state) {
        // 记忆丢失：每次重新进入视口都创建新的状态
        const tokenValue = initialTokenValueForCell(cell);
        state = { index: cell, tokenValue };
        cellStateById.set(id, state);
      }

      const cellBounds = cellIndexToBounds(cell);

      if (!state.rect) {
        state.rect = leaflet.rectangle(cellBounds, {
          weight: 1,
          color: "#666",
          fillOpacity: 0,
        }).addTo(map);

        state.rect.on("click", () => handleCellClick(state));
      } else {
        state.rect.setBounds(cellBounds);
      }

      updateCellMarker(state);
    }
  }

  // 3. 把离开视口的格子 despawn 掉
  const toDelete: string[] = [];

  for (const [id, state] of cellStateById) {
    if (!keepIds.has(id)) {
      if (state.rect) {
        map.removeLayer(state.rect);
        delete state.rect;
      }
      if (state.marker) {
        map.removeLayer(state.marker);
        delete state.marker;
      }
      toDelete.push(id);
    }
  }

  for (const id of toDelete) {
    cellStateById.delete(id);
  }
}

// --- 玩家移动 & 控制按钮（按格子移动）---

function movePlayer(dLat: number, dLng: number) {
  player.lat += dLat;
  player.lng += dLng;

  const newPos = leaflet.latLng(player.lat, player.lng);
  playerMarker.setLatLng(newPos);

  // 可选：让地图跟着玩家走
  map.panTo(newPos);

  updateStatusPanel();
  renderVisibleCells();
}

const movesDiv = document.createElement("div");
movesDiv.id = "movesPanel";
movesDiv.textContent = "Move player:";

const btnN = document.createElement("button");
btnN.textContent = "N";

const btnS = document.createElement("button");
btnS.textContent = "S";

const btnE = document.createElement("button");
btnE.textContent = "E";

const btnW = document.createElement("button");
btnW.textContent = "W";

btnN.onclick = () => movePlayer(CELL_SIZE_DEG, 0);
btnS.onclick = () => movePlayer(-CELL_SIZE_DEG, 0);
btnE.onclick = () => movePlayer(0, CELL_SIZE_DEG);
btnW.onclick = () => movePlayer(0, -CELL_SIZE_DEG);

movesDiv.append(btnN, btnS, btnE, btnW);
controlPanelDiv.append(movesDiv);

// --- 地图 moveend：拖拽 / 缩放时刷新格子 ---

map.on("moveend", () => {
  renderVisibleCells();
});

// --- 初始化 ---

renderVisibleCells();
updateStatusPanel();
