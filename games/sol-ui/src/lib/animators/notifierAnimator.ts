import {
    Activate,
    ActivateBonus,
    ActivateEffect,
    DrawCards,
    EffectType,
    HydratedSolGameState,
    isActivate,
    isActivateBonus,
    isActivateEffect,
    isDrawCards,
    isFuel,
    isMetamorphosize,
    isTribute,
    Metamorphosize,
    StationType,
    Tribute,
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { type GameAction } from '@tabletop/common'
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
        if (!action) {
            return
        }

        if (isActivate(action) || isActivateBonus(action)) {
            this.animateActivate(action, animationContext, isActivateBonus(action))
        } else if (isFuel(action)) {
            this.animateFuel(animationContext)
        } else if (
            isActivateEffect(action) &&
            (action.effect === EffectType.Squeeze || action.effect === EffectType.Augment)
        ) {
            this.animateActivate(action, animationContext)
        } else if (isActivateEffect(action) && action.effect === EffectType.Procreate) {
            this.animateProcreate(action, animationContext)
        } else if (isTribute(action)) {
            this.animateTribute(action, animationContext)
        } else if (isDrawCards(action)) {
            if (from?.activeEffect === EffectType.Squeeze) {
                this.animateDrawCards(action, animationContext)
            }
        } else if (isMetamorphosize(action)) {
            this.animateMetamorphisis(action, animationContext)
        }
    }

    animateActivate(
        action: Activate | ActivateBonus | ActivateEffect | DrawCards,
        animationContext: AnimationContext,
        isBonus: boolean = false
    ) {
        if (action.metadata?.energyAdded ?? 0 > 0) {
            this.gameSession.forcedCallToAction = `${action.metadata?.energyAdded ?? 0} ${isBonus ? 'BONUS ' : ''} ENERGY ADDED`
            animationContext.ensureDuration(1.5)
        } else if (action.metadata?.createdSundiverIds.length ?? 0 > 0) {
            const plural = (action.metadata?.createdSundiverIds?.length ?? 0) === 1 ? '' : 'S'
            this.gameSession.forcedCallToAction = `${action.metadata?.createdSundiverIds?.length ?? 0} ${isBonus ? 'BONUS ' : ''} SUN DIVER${plural} BUILT`
            animationContext.ensureDuration(1.5)
        } else if (action.metadata?.momentumAdded ?? 0 > 0) {
            this.gameSession.forcedCallToAction = `${action.metadata?.momentumAdded ?? 0} ${isBonus ? 'BONUS ' : ''} MOMENTUM GAINED`
            animationContext.ensureDuration(1.5)
        }
    }

    animateFuel(animationContext: AnimationContext) {
        this.gameSession.forcedCallToAction = 'ADDED 3 MOVEMENT POINTS'
        animationContext.ensureDuration(1.5)
    }

    animateProcreate(action: ActivateEffect, animationContext: AnimationContext) {
        const createdCount = action.metadata?.createdSundiverIds?.length ?? 0

        const plural = createdCount === 1 ? '' : 'S'
        this.gameSession.forcedCallToAction = `${createdCount} SUN DIVER${plural} PROCREATED`
        animationContext.ensureDuration(1.5)
    }

    animateTribute(action: Tribute, animationContext: AnimationContext) {
        const payments = action.metadata?.payments ?? {}
        const numCubes = Object.values(payments).reduce((sum, val) => sum + val, 0)
        this.gameSession.forcedCallToAction = `COLLECTED TRIBUTE OF ${numCubes} ENERGY`
        animationContext.ensureDuration(1.5)
    }

    animateDrawCards(action: DrawCards, animationContext: AnimationContext) {
        const message = action.metadata?.removedStation
            ? `SYSTEM MALFUNCTION! YOUR STATION WAS DESTROYED`
            : `SAFE! YOUR STATION SURVIVED THE SQUEEZE`
        animationContext.actionTimeline.call(
            () => {
                this.gameSession.forcedCallToAction = message
            },
            [],
            0.5
        )
        if (!action.metadata?.removedStation) {
            animationContext.actionTimeline.call(
                () => {
                    this.animateActivate(action, animationContext)
                },
                [],
                2.5
            )
            animationContext.ensureDuration(4)
        }
    }

    animateMetamorphisis(action: Metamorphosize, animationContext: AnimationContext) {
        const originalStationType = action.metadata?.priorStation.type
        const newStationType = action.metadata?.newStation.type
        if (!originalStationType || !newStationType) {
            return
        }

        const message = `CONVERTED ${this.nameForStationType(originalStationType)} TO ${this.nameForStationType(newStationType)}`
        this.playMessage(message, animationContext)
    }

    nameForStationType(type: StationType) {
        switch (type) {
            case StationType.EnergyNode:
                return 'ENERGY NODE'
            case StationType.SundiverFoundry:
                return 'SUNDIVER FOUNDRY'
            case StationType.TransmitTower:
                return 'TRANSMIT TOWER'
        }
    }

    playMessage(
        message: string,
        animationContext: AnimationContext,
        position: number = 0,
        duration: number = 1.5
    ) {
        animationContext.actionTimeline.call(
            () => {
                this.gameSession.forcedCallToAction = message
            },
            [],
            position
        )

        const currentDuration = animationContext.actionTimeline.duration()
        const totalDuration = currentDuration + duration
        animationContext.ensureDuration(totalDuration)
    }
}
