// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
// 样式：Leaflet 自带样式 + 你项目的 style.css
import "leaflet/dist/leaflet.css";
import "./style.css";

// 修复 Leaflet 默认 marker 图标丢失的问题（老师给的）
import "./_leafletWorkaround.ts";

// 运气函数，用于确定性生成 token
import luck from "./_luck.ts";

// --- 基本 UI 布局 ---
const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
controlPanelDiv.textContent = "World of Bits – D3.a (core map only)";
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
statusPanelDiv.textContent = "Player position: classroom";
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
  statusPanelDiv.textContent =
    player.tokenInHand === null
      ? "In hand: (empty)"
      : `In hand: ${player.tokenInHand}`;
}

// ========= Grid & token state =========

// 每个格子的“度数大小”（大概一个房子尺寸）
const CELL_SIZE_DEG = 0.0001;

// 网格索引类型
type CellIndex = {
  row: number; // 纬度方向
  col: number; // 经度方向
};

// 每个 cell 的状态：索引 + token 值（没有则为 null）+ 可选 marker 引用
type CellState = {
  index: CellIndex;
  tokenValue: number | null;
  marker?: leaflet.Marker;
};

// 存储所有已生成的 cell 状态
const cellStateById = new Map<string, CellState>();

// 生成唯一 cellId，用于 luck 的 key
function cellId(cell: CellIndex): string {
  return `${cell.row},${cell.col}`;
}

// 用 luck 决定这个 cell 是否有 token，D3.a 先简单做：30% 概率生成 1
const TOKEN_SPAWN_PROBABILITY = 0.3;
const TOKEN_SEED_PREFIX = "world-of-bits-d3a";

function initialTokenValueForCell(cell: CellIndex): number | null {
  const id = cellId(cell);
  const r = luck(`${TOKEN_SEED_PREFIX}:${id}`); // 0~1 之间，但对同一个 id 永远一样

  if (r < TOKEN_SPAWN_PROBABILITY) {
    return 1; // 先统一生成 1，之后想玩花样可以再改
  } else {
    return null;
  }
}

// lat/lng -> cell index
function latLngToCellIndex(lat: number, lng: number): CellIndex {
  const row = Math.floor(lat / CELL_SIZE_DEG);
  const col = Math.floor(lng / CELL_SIZE_DEG);
  return { row, col };
}

// cell index -> 这个 cell 的地理边界（左下 & 右上）
function cellIndexToBounds(cell: CellIndex): leaflet.LatLngBounds {
  const minLat = cell.row * CELL_SIZE_DEG;
  const minLng = cell.col * CELL_SIZE_DEG;
  const maxLat = minLat + CELL_SIZE_DEG;
  const maxLng = minLng + CELL_SIZE_DEG;
  return leaflet.latLngBounds([minLat, minLng], [maxLat, maxLng]);
}

// 玩家所在的 cell
const PLAYER_CELL = latLngToCellIndex(
  CLASSROOM_LATLNG.lat,
  CLASSROOM_LATLNG.lng,
);

// 在玩家附近画一片格子 + 初始 token
function drawGridAroundPlayer() {
  const radiusInCells = 20; // 上下左右各 20 格，可按需要调大/调小

  for (let dr = -radiusInCells; dr <= radiusInCells; dr++) {
    for (let dc = -radiusInCells; dc <= radiusInCells; dc++) {
      const cell: CellIndex = {
        row: PLAYER_CELL.row + dr,
        col: PLAYER_CELL.col + dc,
      };

      const bounds = cellIndexToBounds(cell);
      const id = cellId(cell);

      // 如果之前已经有这个 cell 的状态，就复用；否则创建新的初始状态
      let state = cellStateById.get(id);
      if (!state) {
        const tokenValue = initialTokenValueForCell(cell);
        state = { index: cell, tokenValue };
        cellStateById.set(id, state);
      }

      // 画 cell 的矩形边框
      const rect = leaflet.rectangle(bounds, {
        weight: 1,
        color: "#666", // 边框颜色
        fillOpacity: 0, // 不填充
      });

      rect.addTo(map);

      // 如果这个 cell 有 token，就在中心画一个数字
      if (state.tokenValue !== null) {
        const center = bounds.getCenter();

        const icon = leaflet.divIcon({
          className: "token-icon",
          html: `<span>${state.tokenValue}</span>`,
          iconSize: [24, 24],
        });

        const marker = leaflet.marker(center, { icon }).addTo(map);
        state.marker = marker;
      }
    }
  }
}

drawGridAroundPlayer();
updateStatusPanel();
