import { gsap } from 'gsap'
import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import type { HydratedUrbinoGameState, UrbinoGameState } from '@tabletop/urbino'
import type { UrbinoGameSession } from '$lib/model/session.svelte.js'
import { squareCenter } from '$lib/board/geometry.js'
import { StateAnimator } from './stateAnimator.js'

const LIFT_SCALE = 1.18
const LIFT_DURATION = 0.12
const GLIDE_START = 0.08
const GLIDE_DURATION = 0.5
const LAND_DURATION = 0.14
const FALLBACK_DURATION = 0.18

export class ArchitectMoveAnimator extends StateAnimator<
    UrbinoGameState,
    HydratedUrbinoGameState,
    UrbinoGameSession
> {
    private readonly pawns = new Map<number, SVGGElement>()

    // Where each pawn is drawn. A replay plays several actions before the visible state catches up,
    // so a pawn that has finished gliding stays on its new square until that state lands.
    positions: number[] = $derived([...this.gameSession.gameState.architects])

    pawn(index: number) {
        return (node: SVGGElement) => {
            this.pawns.set(index, node)
            return () => {
                if (this.pawns.get(index) === node) this.pawns.delete(index)
            }
        }
    }

    override async onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedUrbinoGameState
        from?: HydratedUrbinoGameState
        action?: GameAction
        animationContext: AnimationContext
    }): Promise<void> {
        if (!from) return
        to.architects.forEach((destination, index) => {
            const origin = from.architects[index]
            const pawn = this.pawns.get(index)
            if (!pawn || origin < 0 || destination < 0 || origin === destination) return

            const start = squareCenter(origin)
            const end = squareCenter(destination)
            const offset = { x: end.x - start.x, y: end.y - start.y }
            const timeline = animationContext.actionTimeline

            if (action) {
                timeline.to(pawn, { scale: LIFT_SCALE, duration: LIFT_DURATION, ease: 'power1.out' }, 0)
                timeline.to(
                    pawn,
                    { x: offset.x, y: offset.y, duration: GLIDE_DURATION, ease: 'power2.inOut' },
                    GLIDE_START
                )
                timeline.to(
                    pawn,
                    { scale: 1, duration: LAND_DURATION, ease: 'power1.in' },
                    GLIDE_START + GLIDE_DURATION - LAND_DURATION
                )
            } else {
                timeline.to(pawn, { x: offset.x, y: offset.y, duration: FALLBACK_DURATION, ease: 'power2.out' }, 0)
            }

            animationContext.afterAnimations(() => {
                this.positions = this.positions.map((position, other) => (other === index ? destination : position))
                gsap.set(pawn, { x: 0, y: 0, scale: 1 })
            })
        })
    }
}
