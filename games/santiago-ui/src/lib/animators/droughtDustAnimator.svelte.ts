import { gsap } from 'gsap'
import { tick } from 'svelte'
import { isFieldSquare } from '@tabletop/santiago'
import { BORDER_X, BORDER_Y, CELL_H, CELL_W, COL_STARTS, ROW_STARTS } from '$lib/utils/boardGeometry.js'
import { intersectionKey } from '$lib/utils/canalGeometry.js'
import { StateAnimator, type StateChange } from './stateAnimator.js'

export const DUST_PARTICLES = 16
const RISE = 1.3
const FIELD_STAGGER = 0.12
const FLIP = 0.45

export type DustPuff = { key: string; x: number; y: number }

type Square = { col: number; row: number }

// When fields dry out, each one's card flips over to desert and then dust rises from it. The flip
// cards and the puffs are transient presence (Pattern B); once every card shows its desert side,
// the board shows the step's squares through the session's board preview. All of it holds until
// the state publishes.
export class DroughtDustAnimator extends StateAnimator {
    puffs: DustPuff[] = $state.raw([])
    flipping: string[] = $state.raw([])

    private readonly particles = new Map<string, SVGElement>()
    private readonly flipCards = new Map<string, HTMLElement>()

    flipCard(col: number, row: number) {
        const key = intersectionKey(col, row)
        return (element: HTMLElement) => {
            this.flipCards.set(key, element)
            return () => {
                this.flipCards.delete(key)
            }
        }
    }

    particle(key: string) {
        return (element: SVGElement) => {
            this.particles.set(key, element)
            return () => {
                this.particles.delete(key)
            }
        }
    }

    clearPreview() {
        gsap.killTweensOf([...this.particles.values(), ...this.flipCards.values()])
        this.puffs = []
        this.flipping = []
    }

    override async onGameStateChange({ to, from, action, animationContext }: StateChange) {
        if (!from || !action) return
        const dried: Square[] = []
        to.board.squares.forEach((column, col) =>
            column.forEach((square, row) => {
                const before = from.board.squares[col][row]
                if (isFieldSquare(square) && square.dried && isFieldSquare(before) && !before.dried) {
                    dried.push({ col, row })
                }
            })
        )
        if (dried.length === 0) return

        this.flipping = dried.map(({ col, row }) => intersectionKey(col, row))
        await this.showPuffs(dried)
        const flipEnd = (fieldIndex: number) => fieldIndex * FIELD_STAGGER + FLIP
        const timeline = this.dustTimeline(flipEnd)
        this.flipping.forEach((key, fieldIndex) => {
            const card = this.flipCards.get(key)
            if (!card) return
            timeline.fromTo(
                card,
                { rotationY: 0 },
                { rotationY: 180, duration: FLIP, ease: 'power2.inOut' },
                fieldIndex * FIELD_STAGGER
            )
        })
        timeline.call(() => {
            this.gameSession.boardPreview.showSquares(to.board.squares)
            this.flipping = []
        }, [], flipEnd(dried.length - 1))
        animationContext.actionTimeline.add(timeline, 0)
    }

    // For the developer harness's mood tuner: plays the dust on any squares without touching the
    // game; it clears itself when done.
    async preview(squares: Square[]) {
        await this.showPuffs(squares)
        const timeline = this.dustTimeline((fieldIndex) => fieldIndex * FIELD_STAGGER)
        timeline.call(() => {
            this.puffs = []
        }, [], timeline.duration())
    }

    private async showPuffs(squares: Square[]) {
        this.puffs = squares.map(({ col, row }) => ({
            key: intersectionKey(col, row),
            x: BORDER_X + COL_STARTS[col] + CELL_W / 2,
            y: BORDER_Y + ROW_STARTS[row] + CELL_H / 2
        }))
        await tick()
    }

    private dustTimeline(startOf: (fieldIndex: number) => number): gsap.core.Timeline {
        const timeline = gsap.timeline()
        this.puffs.forEach((puff, fieldIndex) => {
            for (let i = 0; i < DUST_PARTICLES; i++) {
                const node = this.particles.get(dustParticleKey(puff.key, i))
                if (!node) continue
                const angle = (i / DUST_PARTICLES) * Math.PI * 2
                const start = 8 + ((i * 5) % 4) * 6
                const spread = 24 + ((i * 7) % 5) * 6
                const at = startOf(fieldIndex) + (i % 3) * 0.03
                timeline.fromTo(
                    node,
                    {
                        x: Math.cos(angle) * start,
                        y: Math.sin(angle) * start,
                        scale: 0.6,
                        opacity: 1,
                        transformOrigin: '50% 50%'
                    },
                    {
                        x: Math.cos(angle) * spread + 20,
                        y: Math.sin(angle) * spread * 0.6 - 30,
                        scale: 2,
                        duration: RISE,
                        ease: 'power2.out',
                        immediateRender: false
                    },
                    at
                )
                timeline.to(node, { opacity: 0, duration: RISE, ease: 'power2.in' }, at)
            }
        })
        return timeline
    }
}

export function dustParticleKey(puffKey: string, index: number): string {
    return `${puffKey}|${index}`
}
