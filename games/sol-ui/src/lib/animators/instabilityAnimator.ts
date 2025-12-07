import { HydratedSolGameState, isSolarFlare, SolarFlare, type SolGameState } from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { gsap } from 'gsap'
import type { GameAction } from '@tabletop/common'
import { animate } from '$lib/utils/animations.js'

export class InstabilityAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    constructor(
        gameSession: SolGameSession,
        private spaceWidth: number,
        private markerWidth: number
    ) {
        super(gameSession)
    }

    override async onGameStateChange({
        to,
        from,
        action,
        timeline
    }: {
        to: HydratedSolGameState
        from?: HydratedSolGameState
        action?: GameAction
        timeline: gsap.core.Timeline
    }) {
        if (action) {
            await this.animateAction(action, timeline, to, from)
        }

        const fromInstability = from?.instability
        const toInstability = to.instability
        if (fromInstability && fromInstability === toInstability) {
            return
        }
        animate({
            object: this.element!,
            params: {
                attr: { x: this.calculateMarkerX(toInstability) }
            },
            timeline,
            duration: 0.5,
            onComplete: () => {
                gsap.set(this.element!, { clearProps: 'all' })
            }
        })
    }

    private calculateMarkerX(instability: number): number {
        return (13 - instability) * this.spaceWidth + (this.spaceWidth - this.markerWidth) / 2
    }

    async animateAction(
        action: GameAction,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (isSolarFlare(action)) {
            await this.animateSolarFlare(action, timeline, toState, fromState)
        }
    }

    async animateSolarFlare(
        action: SolarFlare,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        this.gameSession.forcedCallToAction = "A SOLAR FLARE INCREASES THE SUN'S INSTABILITY..."
        timeline.call(
            () => {
                // Pause for dramatic effect
            },
            [],
            1.5
        )
    }
}
