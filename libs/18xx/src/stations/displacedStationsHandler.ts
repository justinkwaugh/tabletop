import type {
    HydratedAction,
    HydratedGameState,
    MachineContext,
    MachineStateHandler
} from '@tabletop/common'
import { controllingOwner, type FinancialState } from '../finance/finance.js'
import type { MapStateData } from '../map/mapState.js'
import { nextOperatingCompany, type OperatingState } from '../operating/operatingSet.js'
import { BetweenCompaniesState } from '../operating/operatingSteps.js'
import { HydratedReturnStation, stationToReturn } from './returnStation.js'

type State = HydratedGameState & FinancialState & MapStateData & OperatingState

/**
 * Holds play for set-aside stations: the operating company returns its own at once; other
 * companies return theirs once the operating company's turn ends, in operating order.
 */
export class DisplacedStationsHandler<S extends State> implements MachineStateHandler<
    HydratedAction,
    S
> {
    constructor(private readonly handler: MachineStateHandler<HydratedAction, S>) {}

    private owner(state: S): string | undefined {
        const station = stationToReturn(state)
        return station && controllingOwner(state, station.companyId)?.playerId
    }
    isValidAction(action: HydratedAction, context: MachineContext<S>): boolean {
        const owner = this.owner(context.gameState)
        if (!owner) return this.handler.isValidAction(action, context)
        return (
            action instanceof HydratedReturnStation &&
            action.playerId === owner &&
            action.stationId === stationToReturn(context.gameState)?.id &&
            action.isValid(context.gameState)
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<S>): string[] {
        const owner = this.owner(context.gameState)
        if (!owner) return this.handler.validActionsForPlayer(playerId, context)
        return owner === playerId ? ['ReturnStation'] : []
    }
    enter(context: MachineContext<S>): void {
        const owner = this.owner(context.gameState)
        if (!owner) {
            this.handler.enter(context)
            return
        }
        context.gameState.activePlayerIds = [owner]
    }
    onAction(action: HydratedAction, context: MachineContext<S>): string {
        if (!(action instanceof HydratedReturnStation))
            return this.handler.onAction(action, context)
        const state = context.gameState
        if (state.machineState !== BetweenCompaniesState && !this.owner(state)) {
            const companyId = nextOperatingCompany(state)
            const president = companyId && controllingOwner(state, companyId)?.playerId
            if (president) state.activePlayerIds = [president]
        }
        return state.machineState
    }
}
