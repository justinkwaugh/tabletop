import {
    Activate,
    ActivateBonus,
    DrawCards,
    EnergyNode,
    HydratedSolGameState,
    isActivate,
    isActivateBonus,
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
import { animate, ensureDuration, fadeIn, scale } from '$lib/utils/animations.js'

export class EnergyNodeAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    constructor(
        gameSession: SolGameSession,
        private energyNode: EnergyNode
    ) {
        super(gameSession)
    }

    override onAttach(): void {
        gsap.set(this.element!, { opacity: 0 })
        fadeIn({
            object: this.element!,
            duration: 0.5
        })
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
        if (isActivate(action) || isActivateBonus(action)) {
            this.animateActivate(action, timeline, to, from)
        }
    }

    animateActivate(
        action: Activate | ActivateBonus,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        this.gameSession.forcedCallToAction = `${action.metadata?.energyAdded ?? 0} ENERGY ADDED`
        ensureDuration(timeline, 1.5)
    }

    animateActivateBonus(
        action: ActivateBonus,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {}
}

export function animateEnergyNode(
    node: HTMLElement | SVGElement,
    params: { animator?: EnergyNodeAnimator }
): { destroy: () => void } | undefined {
    if (!params.animator) {
        return
    }
    params.animator.setElement(node)
    params.animator.register()
    return {
        destroy() {
            params.animator?.unregister()
        }
    }
}
