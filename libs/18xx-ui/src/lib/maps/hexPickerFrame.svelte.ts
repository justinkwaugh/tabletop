import type { Point } from '@tabletop/common'
import { followHex, type HexPlacement } from './followHex.js'

/** Where a picker drawn around a map hex stands: the hex, the tile size there, and its ✗/✓ controls. */
export class HexPickerFrame {
    center: Point = $state({ x: 0, y: 0 })
    width = $state(0)
    height = $state(0)
    tileSize = $state(80)
    hexHeight = $state(100)
    readonly buttonSize = $derived(this.tileSize * 0.42)
    readonly controls = $derived({
        x: Math.max(
            this.buttonSize * 1.2,
            Math.min(this.width - this.buttonSize * 1.2, this.center.x)
        ),
        y:
            Math.max(
                this.buttonSize * 0.6,
                this.center.y - this.hexHeight / 2 - this.buttonSize * 0.65
            ) + 1
    })
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
        if (placement.mapScale !== undefined) this.tileSize = 106 * placement.mapScale
    }
}
