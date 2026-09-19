import {
    StartOperatingRound,
    isStartOperatingRound,
    canStartOperatingRound,
    type HydratedStartOperatingRound
} from './startOperatingRound.js'
import {
    StartStockRound,
    isStartStockRound,
    canStartStockRound,
    type HydratedStartStockRound
} from '../stock/startStockRound.js'
import { nextOperatingCompany } from './operatingSet.js'
import {
    PlaceHomeStations,
    isPlaceHomeStations,
    type HydratedPlaceHomeStations
} from '../stations/placeHomeStations.js'
import { type StationRules, type StationPlacementState } from '../stations/stationPlacement.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { controllingOwner } from '../finance/finance.js'
import type { OperatingState } from './operatingSet.js'
import type { ConstructionState } from '../construction/trackConstruction.js'

type State = HydratedGameState & OperatingState & ConstructionState & StationPlacementState
const StartFields = Type.Object({
    type: Type.Literal('StartOperatingTurn'),
    companyId: Type.String()
})
export const StartOperatingTurn: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof StartFields.properties
> = Type.Object(
    { ...GameAction.properties, ...StartFields.properties },
    { additionalProperties: false }
)
export type StartOperatingTurn = Type.Static<typeof StartOperatingTurn>
const Validator = Compile(StartOperatingTurn)
export function isStartOperatingTurn(action: GameAction): action is StartOperatingTurn {
    return (
        action instanceof HydratedStartOperatingTurn ||
        (action.type === 'StartOperatingTurn' && Validator.Check(action))
    )
}
export class HydratedStartOperatingTurn
    extends HydratableAction<typeof StartOperatingTurn>
    implements StartOperatingTurn
{
    declare type: 'StartOperatingTurn'
    declare companyId: string
    constructor(data: StartOperatingTurn) {
        super(data instanceof HydratedStartOperatingTurn ? data.dehydrate() : data, Validator)
    }
    apply(state: State): void {
        assert(
            this.source === ActionSource.System &&
                state.operatingSet?.privateIncomePaid &&
                !state.operatingSet.completed &&
                nextOperatingCompany(state) === this.companyId,
            'The operating turn belongs to the next company in operating order'
        )
        const owner = controllingOwner(state, this.companyId)
        assertExists(owner, 'The operating company requires a controlling owner')
        state.trackStep = { companyId: this.companyId, lays: [], completed: false }
        state.activePlayerIds = [owner.playerId]
        state.turnManager.startTurn(owner.playerId, state.actionCount + 1)
    }
}
export class StartOperatingTurnHandler implements MachineStateHandler<
    | HydratedStartOperatingTurn
    | HydratedPlaceHomeStations
    | HydratedStartOperatingRound
    | HydratedStartStockRound,
    State
> {
    constructor(private readonly stationRules: StationRules) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        return (
            action.source === ActionSource.System &&
            ((isStartOperatingRound(action) && canStartOperatingRound(context.gameState)) ||
                (isStartStockRound(action) && canStartStockRound(context.gameState)) ||
                (!canStartOperatingRound(context.gameState) &&
                    isPlaceHomeStations(action) &&
                    !!this.stationRules.pendingHomes(context.gameState).length) ||
                (isStartOperatingTurn(action) &&
                    !canStartOperatingRound(context.gameState) &&
                    !this.stationRules.pendingHomes(context.gameState).length &&
                    action.companyId === nextOperatingCompany(context.gameState)))
        )
    }
    validActionsForPlayer(): string[] {
        return []
    }
    enter(context: MachineContext<State>): void {
        if (canStartOperatingRound(context.gameState)) {
            context.addSystemAction(StartOperatingRound, {
                playerId: context.gameState.activePlayerIds[0]
            })
            return
        }
        if (canStartStockRound(context.gameState)) {
            context.addSystemAction(StartStockRound, {
                playerId: context.gameState.activePlayerIds[0]
            })
            return
        }
        if (this.stationRules.pendingHomes(context.gameState).length) {
            context.addSystemAction(PlaceHomeStations, {
                playerId: context.gameState.activePlayerIds[0]
            })
            return
        }
        const companyId = nextOperatingCompany(context.gameState)
        if (companyId) context.addSystemAction(StartOperatingTurn, { companyId })
    }
    onAction(
        action:
            | HydratedStartOperatingTurn
            | HydratedPlaceHomeStations
            | HydratedStartOperatingRound
            | HydratedStartStockRound
    ): string {
        return isStartStockRound(action)
            ? 'StockRound'
            : isStartOperatingTurn(action)
              ? 'LayingTrack'
              : 'OperatingSet'
    }
}
