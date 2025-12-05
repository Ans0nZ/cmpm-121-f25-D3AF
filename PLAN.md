# D3.a: Core mechanics (token collection and crafting)

## Steps

- [x] Copy the starter `main.ts` into `reference.ts` so I can refer back to the Leaflet + luck example
- [x] Clear out `src/main.ts` (start D3.a from a fresh file)
- [x] Re-add the basic imports to `main.ts`:
  - [x] `leaflet` and its CSS
  - [x] `./style.css`
  - [x] `./_leafletWorkaround.ts`
  - [x] `./_luck.ts`
- [x] Create basic layout elements in `main.ts`:
  - [x] A `#map` container that fills most of the screen
  - [x] A small status HUD showing the token in the player’s hand
- [x] Initialize a Leaflet map centered on the classroom location with a reasonable zoom level
- [x] Define a grid cell size (e.g., `CELL_SIZE_DEG = 0.0001`) and helper functions:
  - [x] `latLngToCellIndex(lat, lng)` → `{row, col}`
  - [x] `cellIndexToBounds(cell)` → Leaflet `LatLngBounds`
  - [x] `cellId(cell)` → string used as the situation key for `luck`
- [x] Compute the player’s current cell index from the fixed classroom location

- [x] Render a square region of cells around the player (e.g., 40×40 cells) as rectangles on the map
- [x] For each rendered cell, use `luck(cellId)` (plus a seed string) to decide:
  - [x] whether it has an initial token
  - [x] the initial token value (for D3.a, always `1`)

- [x] Store each cell’s state in an in-memory data structure:
  - [x] `CellState` type: `{ index, tokenValue, marker? }`
  - [x] `cellStates` collection that can be looked up by `cellId`

- [x] Make sure that the initial state of a cell is consistent across page loads:
  - [x] do not call `Math.random()` for spawning
  - [x] only use `luck(seed + cellId)` for initial tokens

- [x] Add a `PlayerState` structure:
  - [x] fixed `lat/lng` for the classroom
  - [x] `tokenInHand: number | null`

- [x] Implement a helper `canInteractWithCell(cellIndex)`:
  - [x] convert player lat/lng to a cell index
  - [x] allow interaction only if the distance in cells is within a small radius (e.g., 3 cells)

- [x] Add a HUD element that clearly shows:
  - [x] whether the player is holding a token
  - [x] what the current token value is (if any)

- [x] Attach a click handler to each cell rectangle:
  - [x] If the cell is too far away, ignore or show a message
  - [x] If the player’s hand is empty and the cell has a token → pick up:
    - [x] move token value into `PlayerState.tokenInHand`
    - [x] set `cell.tokenValue = null`
    - [x] update the cell’s visual marker
    - [x] update the HUD
  - [x] If the player’s hand has a token and the cell is empty → place:
    - [x] set `cell.tokenValue = tokenInHand`
    - [x] set `tokenInHand = null`
    - [x] update the cell’s visual marker and HUD
  - [x] If the player’s hand has a token and the cell has a token of equal value → combine:
    - [x] set `cell.tokenValue = cell.tokenValue * 2`
    - [x] set `tokenInHand = null`
    - [x] update visuals and HUD
  - [x] In all other cases, do nothing or show a “cannot combine” message

- [x] Choose a temporary win threshold for D3.a (e.g., token value 8 or 16)
- [x] On every combine or placement, check for the win condition:
  - [x] If the player’s hand or any cell has a token ≥ threshold, show a simple win message

- [x] Do a quick usability pass:
  - [x] ensure tokens are visible without clicking (e.g., number text in each cell)
  - [x] check that the player can only interact with nearby cells
  - [x] verify that after reloading the page, the initial cell layout is consistent

- [x] Update this PLAN.md to mark completed items and add any new steps discovered during D3.a

# D3.b: Globe-spanning Gameplay

- [x] Extend the grid coordinate system to be earth-spanning and anchored at Null Island (0, 0):
  - [x] Keep using `CELL_SIZE_DEG` and `latLngToCellIndex(lat, lng)` based on latitude / longitude.
  - [x] Document that (0, 0) is the origin of the grid and that cells cover the whole globe.

- [x] Add UI buttons to simulate local player movement by one grid step:
  - [x] Add four buttons to the control panel: Move N, Move S, Move E, Move W.
  - [x] On click, update `player.lat` / `player.lng` by `CELL_SIZE_DEG` in the chosen direction.
  - [x] Update the `playerMarker` position and re-render visible cells.

- [x] Switch from a fixed-radius grid around the classroom to a "viewport-based" grid:
  - [x] Implement `renderVisibleCells()` that:
    - [x] Uses `map.getBounds()` to get the current view rectangle.
    - [x] Computes the required `CellIndex` range to fully cover the screen.
    - [x] Spawns rectangles and token markers for all cells in that range.

- [x] Despawn cells that leave the viewport:
  - [x] Track all currently rendered `cellId`s.
  - [x] When re-rendering, remove rectangles and markers for cells that are no longer visible.
  - [x] Remove their `CellState` entries from the `cellStateById` map.

- [x] Make cells appear "memoryless":
  - [x] When a cell re-enters the viewport after being despawned, create a fresh `CellState`.
  - [x] Use `initialTokenValueForCell(cell)` again so tokens can respawn and be farmed.

- [x] Allow map panning and zooming without moving the player:
  - [x] Attach a `moveend` handler to the Leaflet map.
  - [x] On `moveend`, call `renderVisibleCells()` so cells update to match the current view.

- [x] Update the crafting win condition:
  - [x] Increase the `WIN_VALUE` (e.g., from 16 to 32).
  - [x] Make sure the win check still triggers when the player holds or creates a token ≥ `WIN_VALUE`.

- [x] Do a quick usability / sanity pass for D3.b:
  - [x] Verify that cells fill the screen wherever the player moves on the globe.
  - [x] Confirm that only nearby cells (within interaction radius) can be clicked for crafting.
  - [x] Confirm that leaving and re-entering a region lets the player farm new tokens.

# D3.c: Object persistence

## Flyweight-style cell storage

- [x] Separate _cell coordinates_ from _cell contents_:
  - [x] Keep using `CellIndex { row, col }` for grid coordinates.
  - [x] Introduce a `modifiedCellTokens: Map<string, number | null>` that stores only **modified** cell contents.
- [x] Treat unmodified cells as “virtual”:
  - [x] If a cell is not in `modifiedCellTokens`, compute its token with `initialTokenValueForCell(cell)`.
  - [x] If a cell _is_ in the Map, use that stored value instead.

## Memento-style persistence for modified cells

- [x] Implement `getCellTokenValue(cellIndex)`:
  - [x] Compute `id = cellId(cellIndex)` and look up in `modifiedCellTokens`.
  - [x] If found, return stored value.
  - [x] If not found, return `initialTokenValueForCell(cellIndex)`.

- [x] Implement `setCellTokenValue(cellIndex, newValue)`:
  - [x] Compute `base = initialTokenValueForCell(cellIndex)`.
  - [x] If `newValue === base`, remove the entry from the Map (no need to store).
  - [x] Otherwise, save it in `modifiedCellTokens` so it persists while off-screen.

## Viewport rendering (rebuild-from-scratch)

- [x] Maintain a `visibleCells: Map<string, CellState>` for _only on-screen_ objects:
  - [x] `CellState` stores `{ index, rect, marker? }`.
  - [x] This Map is rebuilt whenever the map moves.
- [x] Implement / update `renderVisibleCells()`:
  - [x] Use `map.getBounds()` to compute visible `CellIndex` range.
  - [x] For each visible cell:
    - [x] Create / reuse a rectangle.
    - [x] Use `getCellTokenValue` to show correct token.
    - [x] Attach click handlers to both rect and token marker.
  - [x] Remove rectangles/markers for cells that are no longer visible.
  - [x] **Do not** clear `modifiedCellTokens` here.

## Gameplay behavior

- [x] When the player picks up, places, or combines tokens:
  - [x] Use `getCellTokenValue` to read.
  - [x] Use `setCellTokenValue` to write.
  - [x] Refresh the corresponding visible cell’s marker.
- [x] Verify behavior:
  - [x] If you change a cell, move it off-screen, then back:
    - [x] The cell remembers the modified token.
  - [x] Unchanged cells are consistent thanks to `luck(seed + cellId)` but don’t occupy memory.

# D3.d: Gameplay Across Real-world Space and Time

## Movement facade

- [x] Define a `MovementDriver` interface with `start()` and `stop()` methods.
- [x] Implement `ButtonMovementDriver` that:
  - [x] Creates the N/S/E/W buttons in a given container.
  - [x] Calls the shared `movePlayerBy(deltaRow, deltaCol)` function.
  - [x] Cleans up its buttons in `stop()`.

## Geolocation-based movement

- [x] Implement `GeolocationMovementDriver` that:
  - [x] Uses `navigator.geolocation.watchPosition` to track the player.
  - [x] Converts real-world lat/lng changes into grid steps and calls `movePlayerBy`.
  - [x] Stops watching in `stop()`.

## Movement mode switching

- [x] Add a control to switch between button-based and geolocation-based movement:
  - [x] Either by query string (`?movement=geolocation`) or an on-screen toggle.
  - [x] When switching, call `oldDriver.stop()` and `newDriver.start()`.

## Persistent game state

- [ ] Design a serializable game state object:
  - [ ] Player lat/lng and `tokenInHand`.
  - [ ] `modifiedCellTokens` contents.
- [ ] On significant changes (movement / pick-up / place / combine):
  - [ ] Save game state to `localStorage`.
- [ ] On page load:
  - [ ] Try to load saved state from `localStorage`.
  - [ ] If present, restore player position and `modifiedCellTokens`, then render.
- [ ] Add a “New Game” control that:
  - [ ] Clears saved state.
  - [ ] Resets player and `modifiedCellTokens`.
