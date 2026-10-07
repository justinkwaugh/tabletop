import { tick } from 'svelte'
import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import {
    isPlaceBuilding,
    type HydratedUrbinoGameState,
    type PlacedBuilding,
    type UrbinoGameState
} from '@tabletop/urbino'
import type { UrbinoGameSession } from '$lib/model/session.svelte.js'
import { StateAnimator } from './stateAnimator.js'

const DROP_START_SCALE = 1.35
const DROP_DURATION = 0.3
const LANDING_SQUASH_SCALE = 0.95
const LANDING_DURATION = 0.16
const REPLAY_HOLD = 1.0

export type IncomingBuilding = { position: number; building: PlacedBuilding }

export class BuildingDropAnimator extends StateAnimator<
    UrbinoGameState,
    HydratedUrbinoGameState,
    UrbinoGameSession
> {
    incoming: IncomingBuilding | undefined = $state()

    // Buildings that have dropped but are not yet in the visible state, which a replay holds back
    // until its last action has played.
    landed: IncomingBuilding[] = $derived.by(() => {
        void this.gameSession.gameState
        return []
    })
    private landingNode: SVGGElement | undefined

    landing() {
        return (node: SVGGElement) => {
            this.landingNode = node
            return () => {
                if (this.landingNode === node) this.landingNode = undefined
            }
        }
    }

    override async onGameStateChange({
        to,
        action,
        animationContext
    }: {
        to: HydratedUrbinoGameState
        from?: HydratedUrbinoGameState
        action?: GameAction
        animationContext: AnimationContext
    }): Promise<void> {
        if (!isPlaceBuilding(action)) return
        const building = to.board[action.position]
        if (!building) return

        this.incoming = { position: action.position, building }
        await tick()
        const node = this.landingNode
        if (!node) return

        const timeline = animationContext.actionTimeline
        timeline.fromTo(
            node,
            { scale: DROP_START_SCALE, opacity: 0, transformOrigin: 'center center' },
            { scale: 1, opacity: 1, duration: DROP_DURATION, ease: 'power2.in' },
            0
        )
        timeline.to(node, { scale: LANDING_SQUASH_SCALE, duration: LANDING_DURATION / 2, ease: 'power1.out' }, DROP_DURATION)
        timeline.to(
            node,
            { scale: 1, duration: LANDING_DURATION / 2, ease: 'power1.in' },
            DROP_DURATION + LANDING_DURATION / 2
        )

        if (this.gameSession.isViewingHistory) {
            animationContext.ensureDuration(DROP_DURATION + LANDING_DURATION + REPLAY_HOLD)
        }

        animationContext.afterAnimations(() => {
            this.landed = [...this.landed, { position: action.position, building }]
            this.incoming = undefined
        })
    }
}
