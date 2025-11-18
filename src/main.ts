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
