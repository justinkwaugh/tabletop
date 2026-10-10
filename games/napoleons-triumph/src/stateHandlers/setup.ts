import { type HydratedAction, type MachineContext, assertExists } from '@tabletop/common'
import { Side } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'
import { StepStateHandler } from './stepStateHandler.js'

export class BiddingStateHandler extends StepStateHandler {
    protected readonly actions = [{ type: ActionType.PlaceBid }, { type: ActionType.PassBid }]

    protected actor(state: HydratedNapoleonsTriumphGameState): string {
        const highBidderId = state.auction?.highBidderId
        const bidder = state.turnManager.turnOrder.find((playerId) => playerId !== highBidderId)
        assertExists(bidder, 'The auction has no bidder')
        return highBidderId === undefined ? state.turnManager.turnOrder[0] : bidder
    }

    override onAction(action: HydratedAction): MachineState {
        return action.type === ActionType.PassBid ? MachineState.ChoosingSide : MachineState.Bidding
    }
}

export class ChoosingSideStateHandler extends StepStateHandler {
    protected readonly actions = [{ type: ActionType.ChooseSide }]

    protected actor(state: HydratedNapoleonsTriumphGameState): string {
        const winner = state.auction?.highBidderId
        assertExists(winner, 'The auction has no winner')
        return winner
    }

    override onAction(): MachineState {
        return MachineState.AlliedSetup
    }
}

export class AlliedSetupStateHandler extends StepStateHandler {
    protected readonly actions = [{ type: ActionType.DeployArmy }]

    protected actor(state: HydratedNapoleonsTriumphGameState): string {
        return state.playerOf(Side.Allied).playerId
    }

    override onAction(): MachineState {
        return MachineState.FrenchSetup
    }
}

export class FrenchSetupStateHandler extends StepStateHandler {
    protected readonly actions = [{ type: ActionType.DeployArmy }]

    protected actor(state: HydratedNapoleonsTriumphGameState): string {
        return state.playerOf(Side.French).playerId
    }

    override onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedNapoleonsTriumphGameState>
    ): MachineState {
        return MachineState.Commanding
    }
}
