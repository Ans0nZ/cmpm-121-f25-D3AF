// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
// 样式：Leaflet 自带样式 + 你项目的 style.css
import "leaflet/dist/leaflet.css";
import "./style.css";

// 修复 Leaflet 默认 marker 图标丢失的问题（老师给的）
import "./_leafletWorkaround.ts";

// （之后会用到的运气函数，先导入着）
//import luck from "./_luck.ts";

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

// 老师 starter code 里的教室坐标（照搬）
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// 先用和老师一样的缩放级别
const GAMEPLAY_ZOOM_LEVEL = 19;

// 创建地图对象
const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
});

// 添加 OpenStreetMap 底图
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// 在教室位置放一个玩家 marker（暂时代表玩家）
const playerMarker = leaflet.marker(CLASSROOM_LATLNG).addTo(map);
playerMarker.bindTooltip("You are here", { permanent: true, direction: "top" });

// 每个格子的“度数大小”（大概一个房子尺寸）
const CELL_SIZE_DEG = 0.0001;

// 网格索引类型
type CellIndex = {
  row: number; // 纬度方向
  col: number; // 经度方向
};

// lat/lng -> cell index
function latLngToCellIndex(lat: number, lng: number): CellIndex {
  const row = Math.floor(lat / CELL_SIZE_DEG);
  const col = Math.floor(lng / CELL_SIZE_DEG);
  return { row, col };
}

// cell index -> 这个 cell 的地理边界（左下 & 右上）
function cellIndexToBounds(cell: CellIndex): L.LatLngBounds {
  const minLat = cell.row * CELL_SIZE_DEG;
  const minLng = cell.col * CELL_SIZE_DEG;
  const maxLat = minLat + CELL_SIZE_DEG;
  const maxLng = minLng + CELL_SIZE_DEG;
  return L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
}

// 玩家所在的 cell
const PLAYER_CELL = latLngToCellIndex(
  CLASSROOM_LATLNG.lat,
  CLASSROOM_LATLNG.lng,
);

// 在玩家附近画一片格子
function drawGridAroundPlayer() {
  const radiusInCells = 20; // 上下左右各 20 格，可按需要调大/调小

  for (let dr = -radiusInCells; dr <= radiusInCells; dr++) {
    for (let dc = -radiusInCells; dc <= radiusInCells; dc++) {
      const cell: CellIndex = {
        row: PLAYER_CELL.row + dr,
        col: PLAYER_CELL.col + dc,
      };

      const bounds = cellIndexToBounds(cell);

      // 画一个透明填充的矩形，只要边框
      const rect = L.rectangle(bounds, {
        weight: 1,
        color: "#666", // 边框颜色
        fillOpacity: 0, // 不填充
      });

      rect.addTo(map);
    }
  }
}

drawGridAroundPlayer();
