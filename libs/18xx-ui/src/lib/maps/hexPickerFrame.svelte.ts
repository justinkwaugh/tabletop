import type { Point } from '@tabletop/common'
import { followHex, type HexPlacement } from './followHex.js'
import { TileBox, type PieceLayout } from './tilePiece.js'

/** Where a picker drawn around a map hex stands: the hex, the tile size there, and its ✗/✓ controls. */
export class HexPickerFrame {
    center: Point = $state({ x: 0, y: 0 })
    width = $state(0)
    height = $state(0)
    tileSize = $state(80)
    hexHeight = $state(100)
    readonly buttonSize = $derived(this.tileSize * 0.42)
    readonly controls = $derived(this.controlsAbove(this.center, this.hexHeight / 2))
    /** Where the ✗/✓ controls stand above something centred here, this far up and down. */
    controlsAbove(center: Point, halfHeight: number): Point {
        return {
            x: Math.max(
                this.buttonSize * 1.2,
                Math.min(this.width - this.buttonSize * 1.2, center.x)
            ),
            y: Math.max(this.buttonSize * 0.6, center.y - halfHeight - this.buttonSize * 0.65) + 1
        }
    }
    /** Where a point of the map stands on screen, from where the followed hex's centre is on the map. */
    onScreen(point: Point, hexCenter: Point): Point {
        const scale = this.tileSize / TileBox
        return {
            x: this.center.x + (point.x - hexCenter.x) * scale,
            y: this.center.y + (point.y - hexCenter.y) * scale
        }
    }
    /**
     * Where a piece over the followed hex stands on screen, laid out on the map where it covers
     * more than that hex: its middle, half its height, and how many hexes across it is.
     */
    piece(
        hexCenter: Point,
        layout: PieceLayout | undefined
    ): { center: Point; halfHeight: number; extent: number } {
        if (!layout) return { center: this.center, halfHeight: this.hexHeight / 2, extent: 1 }
        return {
            center: this.onScreen(layout.middle, hexCenter),
            halfHeight:
                this.hexHeight / 2 + ((layout.height - TileBox) * this.tileSize) / TileBox / 2,
            extent: Math.max(layout.width, layout.height) / TileBox
        }
    }
    /** The action that keeps the frame on its hex as the map moves. */
    follow(viewport: () => HTMLElement, scheduled?: () => void) {
        return followHex(viewport, (placement) => this.measure(placement), scheduled)
    }
    private measure(placement: HexPlacement) {
        if (this.center.x !== placement.center.x || this.center.y !== placement.center.y)
            this.center = placement.center
        this.width = placement.width
        this.height = placement.height
        this.hexHeight = placement.hexHeight
        if (placement.mapScale !== undefined) this.tileSize = TileBox * placement.mapScale
    }
}
