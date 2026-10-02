import {
    ActionSource,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { controllingOwner } from '../finance/finance.js'
import {
    FinishOperatingTurn,
    isFinishOperatingTurn,
    type OperatingTurnState
} from '../operating/finishOperatingTurn.js'
import { FinishTrains, isFinishTrains } from './finishTrains.js'

const FinishTypes = ['FinishOperatingTurn', 'FinishTrains'] as const
type FinishType = (typeof FinishTypes)[number]

export class AutomaticTrainCompletionHandler<
    State extends HydratedGameState & OperatingTurnState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(private readonly handler: MachineStateHandler<HydratedAction, State>) {}

    private onlyFinish(context: MachineContext<State>, playerId: string): FinishType | undefined {
        const state = context.gameState
        const companyId = state.trainPurchaseStep?.companyId
        if (!companyId || controllingOwner(state, companyId)?.playerId !== playerId)
            return undefined
        const finish = FinishTypes.find((type) =>
            this.handler.validActionsForPlayer(playerId, context).includes(type)
        )
        return finish &&
            !state.activePlayerIds.some((id) =>
                this.handler.validActionsForPlayer(id, context).some((action) => action !== finish)
            )
            ? finish
            : undefined
    }

    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        if (
            (isFinishOperatingTurn(action) || isFinishTrains(action)) &&
            action.source === ActionSource.System
        )
            return (
                action.companyId === context.gameState.trainPurchaseStep?.companyId &&
                this.onlyFinish(context, action.playerId) === action.type
            )
        return this.handler.isValidAction(action, context)
    }

    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        return this.handler.validActionsForPlayer(playerId, context)
    }

    enter(context: MachineContext<State>): void {
        this.handler.enter(context)
        const companyId = context.gameState.trainPurchaseStep?.companyId
        const playerId = companyId && controllingOwner(context.gameState, companyId)?.playerId
        const finish = companyId && playerId ? this.onlyFinish(context, playerId) : undefined
        if (finish)
            context.addSystemAction(
                finish === 'FinishTrains' ? FinishTrains : FinishOperatingTurn,
                { playerId, companyId }
            )
    }

    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return this.handler.onAction(action, context)
    }
}
