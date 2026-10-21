import type {
    HydratedAction,
    HydratedGameState,
    MachineContext,
    MachineStateHandler
} from '@tabletop/common'
import { controllingOwner, type FinancialState } from '../finance/finance.js'
import type { MapStateData } from '../map/mapState.js'
import type { DisplacedStation } from '../map/station.js'
import { nextOperatingCompany, type OperatingState } from '../operating/operatingSet.js'
import { BetweenCompaniesState } from '../operating/operatingSteps.js'
import { HydratedReturnStation, displacedStations } from './returnStation.js'

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

    /** The station whose owner must act now, if any. */
    pending(state: S): DisplacedStation | undefined {
        const displaced = displacedStations(state)
        if (!displaced.length) return undefined
        if (state.machineState !== BetweenCompaniesState) {
            const companyId = nextOperatingCompany(state)
            return displaced.find((station) => station.companyId === companyId)
        }
        const order = state.operatingSet?.companyOrder ?? []
        const rank = (companyId: string) => {
            const index = order.indexOf(companyId)
            return index < 0 ? order.length : index
        }
        return [...displaced].sort((a, b) => rank(a.companyId) - rank(b.companyId))[0]
    }
    private owner(state: S): string | undefined {
        const station = this.pending(state)
        return station && controllingOwner(state, station.companyId)?.playerId
    }
    isValidAction(action: HydratedAction, context: MachineContext<S>): boolean {
        const owner = this.owner(context.gameState)
        if (!owner) return this.handler.isValidAction(action, context)
        return (
            action instanceof HydratedReturnStation &&
            action.playerId === owner &&
            action.stationId === this.pending(context.gameState)?.id &&
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
        // The operating company resumes its turn with its president acting again.
        const state = context.gameState
        if (state.machineState !== BetweenCompaniesState && !this.owner(state)) {
            const companyId = nextOperatingCompany(state)
            const president = companyId && controllingOwner(state, companyId)?.playerId
            if (president) state.activePlayerIds = [president]
        }
        return state.machineState
    }
}
