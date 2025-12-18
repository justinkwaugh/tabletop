import {
    Activate,
    ActivateBonus,
    ActivateEffect,
    Convert,
    DrawCards,
    EffectType,
    EnergyNode,
    Fuel,
    HydratedSolGameState,
    isActivate,
    isActivateBonus,
    isActivateEffect,
    isConvert,
    isDrawCards,
    isFuel,
    isSolarFlare,
    MachineState,
    SolarFlare,
    Station,
    StationType,
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { gsap } from 'gsap'
import { Point, sameCoordinates, type GameAction, type OffsetCoordinates } from '@tabletop/common'
import { animate, ensureDuration, fadeIn, fadeOut, scale } from '$lib/utils/animations.js'
import { tick } from 'svelte'
import type { AnimationContext } from '@tabletop/frontend-components'

// Only used to put notifications in the action panel... no visual animation here
export class NotifierAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
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
        if (isActivate(action) || isActivateBonus(action)) {
            this.animateActivate(action, animationContext, isActivateBonus(action))
        } else if (isFuel(action)) {
            this.animateFuel(animationContext)
        } else if (
            isActivateEffect(action) &&
            (action.effect === EffectType.Squeeze || action.effect === EffectType.Augment)
        ) {
            this.animateActivate(action, animationContext, false)
        }
    }

    animateActivate(
        action: Activate | ActivateBonus | ActivateEffect,
        animationContext: AnimationContext,
        isBonus: boolean
    ) {
        if (action.metadata?.energyAdded ?? 0 > 0) {
            this.gameSession.forcedCallToAction = `${action.metadata?.energyAdded ?? 0} ${isBonus ? 'BONUS ' : ''} ENERGY ADDED`
        } else if (action.metadata?.createdSundiverIds ?? 0 > 0) {
            const plural = (action.metadata?.createdSundiverIds?.length ?? 0) === 1 ? '' : 'S'
            this.gameSession.forcedCallToAction = `${action.metadata?.createdSundiverIds?.length ?? 0} ${isBonus ? 'BONUS ' : ''} SUN DIVER${plural} BUILT`
        } else if (action.metadata?.momentumAdded ?? 0 > 0) {
            this.gameSession.forcedCallToAction = `${action.metadata?.momentumAdded ?? 0} ${isBonus ? 'BONUS ' : ''} MOMENTUM GAINED`
        }

        animationContext.ensureDuration(1.5)
    }

    animateFuel(animationContext: AnimationContext) {
        this.gameSession.forcedCallToAction = 'ADDED 3 MOVEMENT POINTS'
        animationContext.ensureDuration(1.5)
    }
}
