import { tick } from 'svelte'
import { prefersReducedMotion } from 'svelte/motion'
import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import type { HydratedFeudumGameState } from '@tabletop/feudum'
import type { SeatPouch } from '$lib/model/seatPanel.js'

/** R-3.1-H1 How long a pouch takes to turn over at the reveal. */
export const PouchTurnSeconds = 0.42

/** All the turn touches on a pouch: its transform, written by the tween alone. */
export interface PouchElement {
    readonly style: Pick<CSSStyleDeclaration, 'transform'>
}

export interface PouchChange {
    readonly from?: HydratedFeudumGameState
    readonly to: HydratedFeudumGameState
    readonly action?: GameAction
    readonly animationContext: AnimationContext
    /** The pouch as this viewer's panel shows it on a state. */
    readonly pouchOf: (state: HydratedFeudumGameState, playerId: string) => SeatPouch
}

function turned(degrees: number): string {
    return `perspective(12em) rotateY(${degrees}deg)`
}

/**
 * R-3.1-H1 The pouches turn over, edge on to face up, when every hand is final: one motion of the
 * state change, so it is ordered with the other animators and follows replay and silent restoring.
 * With the Action, each pouch the reveal turns shows its face before the state does (a pre-reactivity
 * override) and turns on the action timeline, every one from the same moment for the same time.
 * Without one (Undo, a step through history) the pouch simply shows what the state says, either
 * way, so nothing turns backwards; a silent restore never reaches here.
 */
export class PouchAnimator {
    /** The seats whose pouch the reveal is turning, with the face it turns to. */
    revealing: ReadonlyMap<string, SeatPouch> = $state.raw(new Map())

    private readonly elements = new Map<string, Set<PouchElement>>()
    private readonly turning = new Set<PouchElement>()
    private generation = 0

    constructor(private readonly reduced: () => boolean = () => prefersReducedMotion.current) {}

    /** Each view of a seat's pouch registers here for as long as it is drawn. */
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
        // Edge on from the first frame the face is drawn, so it is never seen flat before it turns.
        for (const element of targets) {
            this.turning.add(element)
            element.style.transform = turned(90)
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
                        element.style.transform = turned(Math.round((1 - clock.t) * 90))
                    }
                }
            },
            0
        )
    }

    /** The state is about to show: the override gives way to it, and no pouch stays turned. */
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
}
