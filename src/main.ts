// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";

const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
controlPanelDiv.textContent = "World of Bits – D3.a (core mechanics)";
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

const PLAYER_CELL = latLngToCellIndex(
  CLASSROOM_LATLNG.lat,
  CLASSROOM_LATLNG.lng,
);

// 距离 & 交互限制
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

// Marker 更新
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

// 点击逻辑
const WIN_VALUE = 16;

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
    return;
  }

  alert("Cannot interact with this cell in that way.");
}

// 画格子 + 初始 token
function drawGridAroundPlayer() {
  const radiusInCells = 20;

  for (let dr = -radiusInCells; dr <= radiusInCells; dr++) {
    for (let dc = -radiusInCells; dc <= radiusInCells; dc++) {
      const cell: CellIndex = {
        row: PLAYER_CELL.row + dr,
        col: PLAYER_CELL.col + dc,
      };

      const bounds = cellIndexToBounds(cell);
      const id = cellId(cell);

      let state = cellStateById.get(id);
      if (!state) {
        const tokenValue = initialTokenValueForCell(cell);
        state = { index: cell, tokenValue };
        cellStateById.set(id, state);
      }

      const rect = leaflet.rectangle(bounds, {
        weight: 1,
        color: "#666",
        fillOpacity: 0,
      }).addTo(map);

      rect.on("click", () => handleCellClick(state));
      updateCellMarker(state);
    }
  }
}

drawGridAroundPlayer();
updateStatusPanel();
