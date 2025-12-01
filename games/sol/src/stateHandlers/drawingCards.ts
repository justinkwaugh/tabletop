import {
    type HydratedAction,
    type MachineStateHandler,
    ActionSource,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedDrawCards, isDrawCards } from '../actions/drawCards.js'
import { Suit } from '../components/cards.js'
import { SolarFlare } from '../actions/solarFlare.js'
import { nanoid } from 'nanoid'

// Transition from DrawingCards(DrawCards) -> SolarFlares | ChoosingCard

export class DrawingCardsStateHandler implements MachineStateHandler<HydratedDrawCards> {
    isValidAction(action: HydratedAction, context: MachineContext): action is HydratedDrawCards {
        if (!action.playerId) return false
        return isDrawCards(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        return [ActionType.DrawCards]
    }

    enter(_context: MachineContext) {}

    onAction(action: HydratedDrawCards, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState

        const playerState = gameState.getPlayerState(action.playerId)
        const drawnCards = playerState.drawnCards ?? []

        // Check for solar flares and handle them first
        const numSolarFlares = drawnCards.filter((card) => card.suit === Suit.Flare).length

        if (numSolarFlares > 0) {
            gameState.solarFlares = numSolarFlares
            const solarFlareAction: SolarFlare = {
                type: ActionType.SolarFlare,
                id: nanoid(),
                gameId: context.gameState.gameId,
                source: ActionSource.System
            }
            context.addPendingAction(solarFlareAction)
            return MachineState.SolarFlares
        } else {
            return MachineState.ChoosingCard
        }
    }
}
