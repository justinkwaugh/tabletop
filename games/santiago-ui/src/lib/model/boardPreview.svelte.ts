import type { BoardSquare, PlantingTile } from '@tabletop/santiago'

// What the board and the tile strip show while a transition animates, before its state publishes
// (Pattern C). Each step that changes them writes its own `to`, so when several actions arrive
// together the latest step's view always wins; it clears when the state publishes.
export class BoardPreview {
    squares: BoardSquare[][] | undefined = $state.raw(undefined)
    tiles: PlantingTile[] | undefined = $state.raw(undefined)
    // The tiles are being dealt: the strip shows each tile's back and face for the flip.
    dealing = $state(false)

    showSquares(squares: BoardSquare[][]) {
        this.squares = squares
    }

    showTiles(tiles: PlantingTile[], dealing: boolean) {
        this.tiles = tiles
        this.dealing = dealing
    }

    clear() {
        this.squares = undefined
        this.tiles = undefined
        this.dealing = false
    }
}
