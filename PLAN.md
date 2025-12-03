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

## Steps

- [x] Extend the grid coordinate system to be earth-spanning and anchored at Null Island (0, 0):
  - [x] Keep using `CELL_SIZE_DEG` and `latLngToCellIndex(lat, lng)` based on latitude / longitude.
  - [x] Document that (0, 0) is the origin of the grid and that cells cover the whole globe.

- [x] Add UI buttons to simulate local player movement by one grid step:
  - [x] Add four buttons to the control panel: Move N, Move S, Move E, Move W.
  - [x] On click, update `player.lat` / `player.lng` by `CELL_SIZE_DEG` in the chosen direction.
  - [x] Update the `playerMarker` position and re-render visible cells.

- [ ] Switch from a fixed-radius grid around the classroom to a "viewport-based" grid:
  - [ ] Implement `renderVisibleCells()` that:
    - [ ] Uses `map.getBounds()` to get the current view rectangle.
    - [ ] Computes the required `CellIndex` range to fully cover the screen.
    - [ ] Spawns rectangles and token markers for all cells in that range.

- [ ] Despawn cells that leave the viewport:
  - [ ] Track all currently rendered `cellId`s.
  - [ ] When re-rendering, remove rectangles and markers for cells that are no longer visible.
  - [ ] Remove their `CellState` entries from the `cellStateById` map.

- [ ] Make cells appear "memoryless":
  - [ ] When a cell re-enters the viewport after being despawned, create a fresh `CellState`.
  - [ ] Use `initialTokenValueForCell(cell)` again so tokens can respawn and be farmed.

- [ ] Allow map panning and zooming without moving the player:
  - [ ] Attach a `moveend` handler to the Leaflet map.
  - [ ] On `moveend`, call `renderVisibleCells()` so cells update to match the current view.

- [ ] Update the crafting win condition:
  - [ ] Increase the `WIN_VALUE` (e.g., from 16 to 32).
  - [ ] Make sure the win check still triggers when the player holds or creates a token ≥ `WIN_VALUE`.

- [ ] Do a quick usability / sanity pass for D3.b:
  - [ ] Verify that cells fill the screen wherever the player moves on the globe.
  - [ ] Confirm that only nearby cells (within interaction radius) can be clicked for crafting.
  - [ ] Confirm that leaving and re-entering a region lets the player farm new tokens.
