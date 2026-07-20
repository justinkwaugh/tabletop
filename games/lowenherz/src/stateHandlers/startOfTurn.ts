import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { ActionCardType } from '../definition/actionCards.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { DrawActionCard, HydratedDrawActionCard } from '../actions/drawActionCard.js'
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
                gameState.currentActionCard = undefined
                // Silver Mine auto-cascades straight into drawing the next card, per
                // the rulebook - no extra round-trip from the client is needed.
                context.addSystemAction(DrawActionCard, { playerId: gameState.firstPlayerId })
                return MachineState.StartOfTurn
            }
            case ActionCardType.KingIsDead: {
                action.metadata = { ...action.metadata, hillScoring: awardHillPowerPoints(gameState) }
                return MachineState.EndOfGame
            }
            case ActionCardType.Standard: {
                gameState.decisions = []
                return MachineState.ChoosingActions
            }
            default: {
                throw Error('DrawActionCard resolved with no current action card')
            }
        }
    }
}
