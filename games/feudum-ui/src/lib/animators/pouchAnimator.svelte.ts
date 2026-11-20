import { tick } from 'svelte'
import { prefersReducedMotion } from 'svelte/motion'
import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import type { HydratedFeudumGameState } from '@tabletop/feudum'
import type { SeatPouch } from '$lib/model/seatPanel.js'

/** R-3.1-H1 How long a pouch takes to turn over at the reveal. */
export const PouchTurnSeconds = 0.42

export interface PouchElement {
    readonly style: Pick<CSSStyleDeclaration, 'transform'>
}

export interface PouchChange {
    readonly from?: HydratedFeudumGameState
    readonly to: HydratedFeudumGameState
    readonly action?: GameAction
    readonly animationContext: AnimationContext
    readonly pouchOf: (state: HydratedFeudumGameState, playerId: string) => SeatPouch
}

/** R-3.1-H1 The pouches turn face up together when every hand is final. */
export class PouchAnimator {
    revealing: ReadonlyMap<string, SeatPouch> = $state.raw(new Map())

    private readonly elements = new Map<string, Set<PouchElement>>()
    private readonly turning = new Set<PouchElement>()
    private generation = 0

    constructor(private readonly reduced: () => boolean = () => prefersReducedMotion.current) {}

    readonly pouch = (playerId: string) => (element: PouchElement) => {
        const views = this.elements.get(playerId) ?? new Set<PouchElement>()
        views.add(element)
        this.elements.set(playerId, views)
        return () => {
            views.delete(element)
            this.turning.delete(element)
        }
    }

    async onGameStateChange({ from, to, action, animationContext, pouchOf }: PouchChange) {
        if (!from || !action) {
            return
        }
        const revealed = new Map<string, SeatPouch>()
        for (const { playerId } of to.players) {
            const after = pouchOf(to, playerId)
            if (after.status === 'finalised' && pouchOf(from, playerId).status !== 'finalised') {
                revealed.set(playerId, after)
            }
        }
        if (revealed.size === 0) {
            return
        }
        const generation = this.generation
        this.revealing = revealed
        await tick()
        if (generation !== this.generation || this.reduced()) {
            return
        }
        const targets = [...revealed.keys()].flatMap((playerId) => [
            ...(this.elements.get(playerId) ?? [])
        ])
        // Edge on from the first drawn frame, so the face is never seen flat before it turns.
        for (const element of targets) {
            this.turning.add(element)
            element.style.transform = this.turned(90)
        }
        const clock = { t: 0 }
        animationContext.actionTimeline.to(
            clock,
            {
                t: 1,
                duration: PouchTurnSeconds,
                ease: 'power1.out',
                onUpdate: () => {
                    if (generation !== this.generation) {
                        return
                    }
                    for (const element of targets) {
                        element.style.transform = this.turned(Math.round((1 - clock.t) * 90))
                    }
                }
            },
            0
        )
    }

    settle() {
        this.generation += 1
        for (const element of this.turning) {
            element.style.transform = ''
        }
        this.turning.clear()
        if (this.revealing.size > 0) {
            this.revealing = new Map()
        }
    }

    private turned(degrees: number): string {
        return `perspective(12em) rotateY(${degrees}deg)`
    }
}
