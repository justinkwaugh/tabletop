import { gsap } from 'gsap'
import { tick } from 'svelte'
import { isFieldSquare } from '@tabletop/santiago'
import { intersectionKey } from '$lib/utils/canalGeometry.js'
import { FALLBACK_DURATION, StateAnimator, type StateChange } from './stateAnimator.js'

const POP = 0.45
const POP_LAYER = 5

// The board and the tile strip show a planting step's squares and remaining tiles through the
// session's board preview, so the new field exists to pop before the state publishes, and its
// tile has left the strip as it lands.
export class FieldPopAnimator extends StateAnimator {
    private readonly fields = new Map<string, HTMLElement>()
    private popped: HTMLElement[] = []

    field(col: number, row: number) {
        const key = intersectionKey(col, row)
        return (element: HTMLElement) => {
            this.fields.set(key, element)
            return () => {
                this.fields.delete(key)
            }
        }
    }

    clearPreview() {
        const cells = this.popped.flatMap((field) => field.parentElement ?? [])
        gsap.killTweensOf(this.popped)
        gsap.set(this.popped, { clearProps: 'transform' })
        gsap.set(cells, { clearProps: 'overflow,zIndex' })
        this.popped = []
    }

    override async onGameStateChange({ to, from, action, animationContext }: StateChange) {
        if (!from) return
        const planted: string[] = []
        to.board.squares.forEach((column, col) =>
            column.forEach((square, row) => {
                if (isFieldSquare(square) && !isFieldSquare(from.board.squares[col][row])) {
                    planted.push(intersectionKey(col, row))
                }
            })
        )
        if (planted.length === 0) return

        this.gameSession.boardPreview.showSquares(to.board.squares)
        this.gameSession.boardPreview.showTiles(to.revealedTiles, false)
        await tick()
        const nodes = planted.flatMap((key) => this.fields.get(key) ?? [])
        if (nodes.length === 0) return
        this.popped.push(...nodes)

        // The pop overshoots its square, which clips its contents and sits under later squares.
        const cells = nodes.flatMap((field) => field.parentElement ?? [])
        const duration = action ? POP : FALLBACK_DURATION
        gsap.set(cells, { overflow: 'visible', zIndex: POP_LAYER })
        gsap.set(nodes, { scale: 0, transformOrigin: '50% 50%' })
        const timeline = animationContext.actionTimeline
        timeline.to(nodes, { scale: 1, duration, ease: action ? 'back.out(2.2)' : 'power1.out' }, 0)
        timeline.set(cells, { clearProps: 'overflow,zIndex' }, duration)
    }
}
