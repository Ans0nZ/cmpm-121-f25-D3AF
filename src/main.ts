// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";
import "./style.css";

// --- 基本 UI 布局 ---

const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
controlPanelDiv.textContent = "World of Bits – D3.d (geo + persistence)";
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

// movement 模式切换按钮
const movementModeButton = document.createElement("button");
movementModeButton.id = "movementModeButton";
controlPanelDiv.append(movementModeButton);

// New Game 按钮
const newGameButton = document.createElement("button");
newGameButton.id = "newGameButton";
newGameButton.textContent = "New Game";
controlPanelDiv.append(newGameButton);

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

// CellState 专门用来描述“屏幕上的对象”，不直接存 token 数值
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

function initialTokenValueForCell(cell: CellIndex): number | null {
  const id = cellId(cell);
  const r = luck(`${TOKEN_SPAWN_PROBABILITY}:${TOKEN_SEED_PREFIX}:${id}`);
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

// --- 持久化 Map（只存被“修改过”的格子），Flyweight + Memento 核心 ---

// key: cellId, value: 当前 token（包括 null）
const modifiedCellTokens = new Map<string, number | null>();

function getCellTokenValue(index: CellIndex): number | null {
  const id = cellId(index);
  if (modifiedCellTokens.has(id)) {
    return modifiedCellTokens.get(id)!;
  }
  return initialTokenValueForCell(index);
}

function setCellTokenValue(index: CellIndex, newValue: number | null): void {
  const id = cellId(index);
  const base = initialTokenValueForCell(index);

  if (newValue === base) {
    modifiedCellTokens.delete(id);
  } else {
    modifiedCellTokens.set(id, newValue);
  }
}

// --- localStorage 持久化整个游戏状态 ---

type SavedCellEntry = {
  id: string;
  value: number | null;
};

type SavedGameState = {
  playerLat: number;
  playerLng: number;
  tokenInHand: number | null;
  modifiedCells: SavedCellEntry[];
};

const STORAGE_KEY = "world-of-bits-d3-state";

interface GlobalWithStorage {
  localStorage: Storage;
}

function getLocalStorageSafe(): Storage | null {
  if ("localStorage" in globalThis) {
    return (globalThis as unknown as GlobalWithStorage).localStorage;
  }
  return null;
}

function saveGameState(): void {
  const storage = getLocalStorageSafe();
  if (!storage) return;

  const state: SavedGameState = {
    playerLat: player.lat,
    playerLng: player.lng,
    tokenInHand: player.tokenInHand,
    modifiedCells: Array.from(modifiedCellTokens.entries()).map(
      ([id, value]) => ({ id, value }),
    ),
  };

  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadGameState(): void {
  const storage = getLocalStorageSafe();
  if (!storage) return;

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as SavedGameState;

    player.lat = parsed.playerLat;
    player.lng = parsed.playerLng;
    player.tokenInHand = parsed.tokenInHand;

    modifiedCellTokens.clear();
    for (const entry of parsed.modifiedCells ?? []) {
      modifiedCellTokens.set(entry.id, entry.value);
    }

    playerMarker.setLatLng([player.lat, player.lng]);
    map.setView([player.lat, player.lng], GAMEPLAY_ZOOM_LEVEL);
  } catch (err) {
    console.error("Failed to load game state", err);
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
    state.marker.on("click", () => handleCellClick(state));
  }
}

// --- 胜利判定 ---

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
    saveGameState();
    return;
  }

  // 放下：手里有 & 格子空
  if (handHas !== null && cellHas === null) {
    setCellTokenValue(state.index, handHas);
    player.tokenInHand = null;
    updateCellMarker(state);
    updateStatusPanel();
    checkWinCondition(handHas);
    saveGameState();
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
    saveGameState();
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

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const cell: CellIndex = { row, col };
      const id = cellId(cell);
      nextVisibleCellIds.add(id);

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

// 地图移动结束时，刷新视口格子
map.on("moveend", () => {
  renderVisibleCells();
});

// --- 玩家移动（被按钮和 GPS 共用） ---

function movePlayerBy(deltaRow: number, deltaCol: number) {
  player.lat += deltaRow * CELL_SIZE_DEG;
  player.lng += deltaCol * CELL_SIZE_DEG;

  playerMarker.setLatLng([player.lat, player.lng]);
  map.panTo([player.lat, player.lng]);

  updateStatusPanel();
  saveGameState();
}

// --- MovementDriver 接口 + 实现（Facade） ---

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

    this.createButton("Move N", +1, 0);
    this.createButton("Move S", -1, 0);
    this.createButton("Move E", 0, +1);
    this.createButton("Move W", 0, -1);
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

class GeolocationMovementDriver implements MovementDriver {
  private watchId: number | null = null;
  private lastLat: number | null = null;
  private lastLng: number | null = null;

  start(): void {
    if (this.watchId !== null) return;

    if (!("geolocation" in navigator)) {
      alert("Geolocation is not supported; staying in button mode.");
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;

        if (this.lastLat === null || this.lastLng === null) {
          // 第一次定位：把玩家传送到当前位置
          player.lat = newLat;
          player.lng = newLng;
          playerMarker.setLatLng([player.lat, player.lng]);
          map.setView([player.lat, player.lng], GAMEPLAY_ZOOM_LEVEL);
          this.lastLat = newLat;
          this.lastLng = newLng;
          updateStatusPanel();
          renderVisibleCells();
          saveGameState();
          return;
        }

        const dLat = newLat - this.lastLat;
        const dLng = newLng - this.lastLng;

        this.lastLat = newLat;
        this.lastLng = newLng;

        const deltaRow = Math.round(dLat / CELL_SIZE_DEG);
        const deltaCol = Math.round(dLng / CELL_SIZE_DEG);

        if (deltaRow !== 0 || deltaCol !== 0) {
          movePlayerBy(deltaRow, deltaCol);
        }
      },
      (err) => {
        console.error("Geolocation error", err);
        alert("Geolocation error; staying in button mode.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 10_000,
      },
    );
  }

  stop(): void {
    if (this.watchId !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    this.watchId = null;
    this.lastLat = null;
    this.lastLng = null;
  }
}

// --- Movement mode 切换 ---

type MovementMode = "buttons" | "geo";

const buttonDriver = new ButtonMovementDriver(moveButtonsDiv);
const geoDriver = new GeolocationMovementDriver();

let currentMode: MovementMode = "buttons";
let currentDriver: MovementDriver = buttonDriver;

function applyMovementMode(mode: MovementMode): void {
  currentDriver.stop();

  if (mode === "buttons") {
    buttonDriver.start();
    movementModeButton.textContent = "Use GPS movement";
    currentDriver = buttonDriver;
  } else {
    geoDriver.start();
    movementModeButton.textContent = "Use button movement";
    currentDriver = geoDriver;
  }

  currentMode = mode;
}

function getInitialMovementMode(): MovementMode {
  const search = "location" in globalThis
    ? (globalThis.location as Location).search
    : "";

  const params = new URLSearchParams(search);
  const m = params.get("movement");
  if (!m) return "buttons";

  const v = m.toLowerCase();
  if (v === "geolocation" || v === "geo" || v === "gps") return "geo";
  if (v === "buttons" || v === "btn") return "buttons";
  return "buttons";
}

movementModeButton.addEventListener("click", () => {
  const nextMode: MovementMode = currentMode === "buttons" ? "geo" : "buttons";
  applyMovementMode(nextMode);
});

// --- New Game 按钮逻辑 ---

newGameButton.addEventListener("click", () => {
  const confirmed = confirm("Start a new game? Current progress will be lost.");
  if (!confirmed) return;

  modifiedCellTokens.clear();

  player.lat = CLASSROOM_LATLNG.lat;
  player.lng = CLASSROOM_LATLNG.lng;
  player.tokenInHand = null;

  const storage = getLocalStorageSafe();
  if (storage) {
    storage.removeItem(STORAGE_KEY);
  }

  playerMarker.setLatLng([player.lat, player.lng]);
  map.setView([player.lat, player.lng], GAMEPLAY_ZOOM_LEVEL);

  renderVisibleCells();
  updateStatusPanel();
});

// --- 启动顺序：先尝试加载存档，再渲染，再设置 movement 模式 ---

loadGameState();
renderVisibleCells();
updateStatusPanel();

const initialMode = getInitialMovementMode();
applyMovementMode(initialMode);
