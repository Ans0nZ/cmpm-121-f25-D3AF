// @deno-types="npm:@types/leaflet"

// 样式：Leaflet 自带样式 + 你项目的 style.css
import "leaflet/dist/leaflet.css";
import "./style.css";

// 修复 Leaflet 默认 marker 图标丢失的问题（老师给的）
import "./_leafletWorkaround.ts";

// （之后会用到的运气函数，先导入着）
