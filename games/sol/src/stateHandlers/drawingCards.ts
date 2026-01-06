import {
    type HydratedAction,
    type MachineStateHandler,
    ActionSource,
    MachineContext,
    Prng
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedDrawCards, isDrawCards } from '../actions/drawCards.js'
import { Suit } from '../components/cards.js'
import { SolarFlare } from '../actions/solarFlare.js'
import { nanoid } from 'nanoid'
import { Pass, PassContext } from '../actions/pass.js'
import { EffectType } from '../components/effects.js'
import { ActivatingStateHandler } from './activating.js'
import { HydratedActivateEffect, isActivateEffect } from '../actions/activateEffect.js'
import { onActivateEffect } from './postActionHelper.js'

// Transition from DrawingCards(DrawCards) -> SolarFlares | ChoosingCard
// Transition from DrawingCards(ActivateEffect) -> ChoosingCard

type DrawingCardsActions = HydratedDrawCards | HydratedActivateEffect

export class DrawingCardsStateHandler implements MachineStateHandler<DrawingCardsActions> {
    isValidAction(action: HydratedAction, context: MachineContext): action is DrawingCardsActions {
        if (!action.playerId) return false
        return isDrawCards(action) || isActivateEffect(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const actions = [ActionType.DrawCards]
        if (
            HydratedActivateEffect.canActivateHeldEffect(
                context.gameState as HydratedSolGameState,
                playerId
            )
        ) {
            actions.push(ActionType.ActivateEffect)
        }
        return actions
    }

    enter(_context: MachineContext) {}

    onAction(action: DrawingCardsActions, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState

        if (isActivateEffect(action)) {
            return onActivateEffect(action, context)
        }

        const playerState = gameState.getPlayerState(action.playerId)
        const drawnCards = playerState.drawnCards ?? []

        const numSolarFlares = drawnCards.filter((card) => card.suit === Suit.Flare).length
        if (gameState.activeEffect === EffectType.Squeeze) {
            const activation = gameState.getActivationForPlayer(action.playerId)
            if (!activation) {
                throw Error('No activation found for squeeze effect')
            }
            if (numSolarFlares > 0) {
                return ActivatingStateHandler.continueActivatingOrEnd(
                    gameState,
                    context,
                    activation
                )
            } else {
                return ActivatingStateHandler.handleActivation(gameState, context, action.playerId)
            }
        } else {
            return DrawingCardsStateHandler.handleDrawnCards(gameState, context, action.playerId)
        }
    }

    static handleDrawnCards(
        state: HydratedSolGameState,
        context: MachineContext,
        playerId: string
    ) {
        const playerState = state.getPlayerState(playerId)
        const drawnCards = playerState.drawnCards ?? []
        const numSolarFlares = drawnCards.filter((card) => card.suit === Suit.Flare).length

        if (numSolarFlares > 0) {
            state.solarFlares = numSolarFlares
            state.solarFlaresRemaining = numSolarFlares

            const prng = new Prng(state.prng)
            const solarFlareAction: SolarFlare = {
                type: ActionType.SolarFlare,
                id: prng.randId(),
                gameId: context.gameState.gameId,
                source: ActionSource.System
            }
            context.addPendingAction(solarFlareAction)
            return MachineState.SolarFlares
        } else {
            if (!playerState.hasCardChoice()) {
                const passAction: Pass = {
                    type: ActionType.Pass,
                    id: nanoid(),
                    gameId: context.gameState.gameId,
                    playerId,
                    source: ActionSource.System,
                    context: PassContext.NoCardChoice
                }
                context.addPendingAction(passAction)
            }
            return MachineState.ChoosingCard
        }
    }
}
