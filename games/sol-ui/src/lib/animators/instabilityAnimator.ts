import { HydratedSolGameState, isSolarFlare, SolarFlare, type SolGameState } from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { gsap } from 'gsap'
import type { GameAction } from '@tabletop/common'
import { animate, ensureDuration } from '$lib/utils/animations.js'
import type { AnimationContext } from '@tabletop/frontend-components'

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
        animationContext
    }: {
        to: HydratedSolGameState
        from?: HydratedSolGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        if (action) {
            await this.animateAction(action, animationContext.actionTimeline, to, from)
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
            timeline: animationContext.actionTimeline,
            duration: 0.5,
            onComplete: () => {
                gsap.set(this.element!, { clearProps: 'all' })
            },
            position: 0
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
        _toState: HydratedSolGameState,
        _fromState?: HydratedSolGameState
    ) {
        this.gameSession.forcedCallToAction = "A SOLAR FLARE INCREASES THE SUN'S INSTABILITY..."
        ensureDuration(timeline, 1.5)
    }
}
