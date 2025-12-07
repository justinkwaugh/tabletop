import {
    DrawCards,
    HydratedSolGameState,
    isDrawCards,
    isSolarFlare,
    MachineState,
    SolarFlare,
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { gsap } from 'gsap'
import type { GameAction } from '@tabletop/common'
import { animate, scale } from '$lib/utils/animations.js'

export class DeckAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    private pulseTween: gsap.core.Tween | undefined

    constructor(gameSession: SolGameSession) {
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

        if (to.machineState === MachineState.DrawingCards) {
            this.pulseDeck()
        }
    }

    async animateAction(
        action: GameAction,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (isDrawCards(action)) {
            await this.animateDrawCards(action, timeline, toState, fromState)
        }
    }

    async animateDrawCards(
        action: DrawCards,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        this.stopPulsingDeck(timeline)
    }

    private pulseDeck() {
        if (this.pulseTween) {
            return
        }

        this.pulseTween = gsap.to(this.element!, {
            scale: 1.1,
            duration: 1,
            ease: 'power2.inOut',
            yoyo: true,
            repeat: -1,
            svgOrigin: '50% 50%'
        })
    }

    private stopPulsingDeck(timeline?: gsap.core.Timeline) {
        if (!this.pulseTween) {
            return
        }

        this.pulseTween.kill()
        if (this.element) {
            scale({
                object: this.element,
                to: 1,
                duration: 0.2,
                timeline,
                position: 0
            })
        }
        this.pulseTween = undefined
    }
}
