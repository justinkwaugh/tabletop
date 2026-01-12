import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedContainerGameState } from '../model/gameState.js'
import { HydratedBuyMachine } from '../actions/buyMachine.js'
import { HydratedBuyWarehouse } from '../actions/buyWarehouse.js'
import { HydratedBuyContainersForHarbor } from '../actions/buyContainersForHarbor.js'
import { HydratedProduceContainers } from '../actions/produceContainers.js'
import { HydratedSailShip, isSailShip } from '../actions/sailShip.js'
import { HydratedTakeLoan } from '../actions/takeLoan.js'
import { HydratedRepayLoan } from '../actions/repayLoan.js'
import { HydratedPass } from '../actions/pass.js'
import { HydratedCallBroker } from '../actions/callBroker.js'
import {
    HydratedSelectSeizedContainer,
    isSelectSeizedContainer
} from '../actions/selectSeizedContainer.js'
import { HydratedForeignIslandAuction } from '../components/foreignIslandAuction.js'

export type TakingActionsAction =
    | HydratedBuyMachine
    | HydratedBuyWarehouse
    | HydratedBuyContainersForHarbor
    | HydratedProduceContainers
    | HydratedSailShip
    | HydratedCallBroker
    | HydratedTakeLoan
    | HydratedRepayLoan
    | HydratedSelectSeizedContainer
    | HydratedPass

const FREE_ACTIONS = new Set<ActionType>([
    ActionType.TakeLoan,
    ActionType.RepayLoan,
    ActionType.SelectSeizedContainer
])

export class TakingActionsStateHandler
    implements MachineStateHandler<TakingActionsAction>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext
    ): action is TakingActionsAction {
        const state = context.gameState as HydratedContainerGameState
        if (!action.playerId) {
            return false
        }

        if (state.seizure) {
            if (action.type === ActionType.SelectSeizedContainer) {
                return action.playerId === state.seizure.chooserId
            }
            return action.type === ActionType.TakeLoan && HydratedTakeLoan.canTake(state, action.playerId)
        }

        if (!FREE_ACTIONS.has(action.type as ActionType) && state.actionsRemaining <= 0) {
            return false
        }

        switch (action.type) {
            case ActionType.BuyMachine:
                return HydratedBuyMachine.canBuy(state, action.playerId)
            case ActionType.BuyWarehouse:
                return HydratedBuyWarehouse.canBuy(state, action.playerId)
            case ActionType.BuyContainersForHarbor:
                return HydratedBuyContainersForHarbor.canBuy(state, action.playerId)
            case ActionType.ProduceContainers:
                return HydratedProduceContainers.canProduce(state, action.playerId)
            case ActionType.SailShip:
                return HydratedSailShip.canSail(state, action.playerId)
            case ActionType.CallBroker:
                return HydratedCallBroker.canCall(state, action.playerId)
            case ActionType.TakeLoan:
                return HydratedTakeLoan.canTake(state, action.playerId)
            case ActionType.RepayLoan:
                return HydratedRepayLoan.canRepay(state, action.playerId)
            case ActionType.SelectSeizedContainer:
                return false
            case ActionType.Pass:
                return state.actionsRemaining > 0
            default:
                return false
        }
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const state = context.gameState as HydratedContainerGameState

        if (state.seizure) {
            if (state.seizure.chooserId !== playerId) {
                return []
            }
            const actions = [ActionType.SelectSeizedContainer]
            if (HydratedTakeLoan.canTake(state, playerId)) {
                actions.push(ActionType.TakeLoan)
            }
            return actions
        }

        if (state.getActivePlayerId() !== playerId) {
            return []
        }

        const actions: ActionType[] = []

        if (HydratedBuyMachine.canBuy(state, playerId)) {
            actions.push(ActionType.BuyMachine)
        }
        if (HydratedBuyWarehouse.canBuy(state, playerId)) {
            actions.push(ActionType.BuyWarehouse)
        }
        if (HydratedBuyContainersForHarbor.canBuy(state, playerId)) {
            actions.push(ActionType.BuyContainersForHarbor)
        }
        if (HydratedProduceContainers.canProduce(state, playerId)) {
            actions.push(ActionType.ProduceContainers)
        }
        if (HydratedSailShip.canSail(state, playerId)) {
            actions.push(ActionType.SailShip)
        }
        if (HydratedCallBroker.canCall(state, playerId)) {
            actions.push(ActionType.CallBroker)
        }
        if (HydratedTakeLoan.canTake(state, playerId)) {
            actions.push(ActionType.TakeLoan)
        }
        if (HydratedRepayLoan.canRepay(state, playerId)) {
            actions.push(ActionType.RepayLoan)
        }
        if (state.actionsRemaining > 0) {
            actions.push(ActionType.Pass)
        }

        return actions
    }

    enter(context: MachineContext): void {
        const state = context.gameState as HydratedContainerGameState
        if (state.turnNeedsStart) {
            state.startNextTurn()
        }
    }

    onAction(action: TakingActionsAction, context: MachineContext): MachineState {
        const state = context.gameState as HydratedContainerGameState

        if (isSelectSeizedContainer(action)) {
            if (state.seizure) {
                return MachineState.TakingActions
            }
            return MachineState.TakingActions
        }

        if (!FREE_ACTIONS.has(action.type as ActionType)) {
            state.actionsRemaining -= 1
        }

        if (isSailShip(action)) {
            const player = state.getPlayerState(action.playerId)
            if (action.destination.type === 'foreign_island' && player.ship.cargo.length > 0) {
                const bidderIds = state.players
                    .filter((p) => p.playerId !== action.playerId)
                    .map((p) => p.playerId)
                const round = HydratedForeignIslandAuction.createRound(
                    bidderIds,
                    action.playerId,
                    action.id
                )
                state.auction = new HydratedForeignIslandAuction({
                    sellerId: action.playerId,
                    containers: [...player.ship.cargo],
                    phase: 'initial',
                    round: round.dehydrate(),
                    totalBids: {},
                    winningBid: undefined,
                    winningBidderId: undefined,
                    tiedPlayerIds: undefined
                })
                state.actionsRemaining = 0
                state.turnNeedsStart = true
                if (state.turnManager.currentTurn()) {
                    state.turnManager.endTurn(state.actionCount)
                }
                return MachineState.AuctionBidding
            }
        }

        if (state.actionsRemaining > 0) {
            return MachineState.TakingActions
        }

        if (state.turnManager.currentTurn()) {
            state.turnManager.endTurn(state.actionCount)
        }

        if (state.endTriggered) {
            return MachineState.EndOfGame
        }

        state.turnNeedsStart = true
        return MachineState.TakingActions
    }
}
