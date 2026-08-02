import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { ActionCardType } from '../definition/actionCards.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { HydratedDrawActionCard } from '../actions/drawActionCard.js'
import { awardHillPowerPoints } from '../util/hillPowerPoints.js'

type StartOfTurnAction = HydratedDrawActionCard

export class StartOfTurnStateHandler
    implements MachineStateHandler<StartOfTurnAction, HydratedLowenherzGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): action is StartOfTurnAction {
        return action instanceof HydratedDrawActionCard && action.isValidDrawActionCard(context.gameState)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedLowenherzGameState>
    ): ActionType[] {
        return HydratedDrawActionCard.canDrawActionCard(context.gameState, playerId)
            ? [ActionType.DrawActionCard]
            : []
    }

    enter(context: MachineContext<HydratedLowenherzGameState>) {
        context.gameState.activePlayerIds = [context.gameState.firstPlayerId]
    }

    onAction(
        action: StartOfTurnAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): MachineState {
        const gameState = context.gameState
        // The action already drew the card before onAction runs, so this reflects the
        // card that was just flipped.
        const card = gameState.currentActionCard

        switch (card?.type) {
            case ActionCardType.Mining: {
                action.metadata = { ...action.metadata, hillScoring: awardHillPowerPoints(gameState) }
                gameState.discardedActionCard = gameState.currentActionCard
                gameState.currentActionCard = undefined
                // Unlike a standard card's multi-step resolution, Mining has nothing
                // left for anyone to do - but the active player still draws the next
                // card themselves (see discardedActionCard) rather than the game
                // cascading straight into it on their behalf.
                return MachineState.StartOfTurn
            }
            case ActionCardType.KingIsDead: {
                action.metadata = { ...action.metadata, hillScoring: awardHillPowerPoints(gameState) }
                gameState.discardedActionCard = undefined
                return MachineState.EndOfGame
            }
            case ActionCardType.Standard: {
                // Drawing the next card retires any Silver Mine that was sitting on the
                // discard pile - it only lingers there for display between its reveal
                // and this draw. Without this, once the round ends and
                // currentActionCard clears, the stale discard would resurface as the
                // face-up card again (see DeckPiles' `currentActionCard ?? discarded`).
                gameState.discardedActionCard = undefined
                gameState.decisions = []
                return MachineState.ChoosingActions
            }
            default: {
                throw Error('DrawActionCard resolved with no current action card')
            }
        }
    }
}
