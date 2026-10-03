import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    type HydratedGameState,
    type HydratedAction,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { trainsOwnedBy, unownedTrain, type TrainState } from './train.js'
import type { TrainRunningState } from '../routes/route.js'
import {
    DeparturePayments,
    departurePaymentsField,
    settleTrainDepartures
} from './trainDepartures.js'
import type { TrainRules } from './trainPurchase.js'
export function trainsRustingAfterOperation(state: TrainState, companyId: string) {
    return trainsOwnedBy(state, { kind: 'company', companyId }).filter(
        (train) => train.status === 'owned' && train.rustsAfterOperation
    )
}
const Fields = Type.Object({
    type: Type.Literal('RustTrains'),
    companyId: Type.String(),
    metadata: Type.Optional(
        Type.Object(
            { trainIds: Type.Array(Type.String()), departurePayments: DeparturePayments },
            { additionalProperties: false }
        )
    )
})
export const RustTrains: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof Fields.properties
> = Type.Object({ ...GameAction.properties, ...Fields.properties }, { additionalProperties: false })
export type RustTrains = Type.Static<typeof RustTrains>
const Validator = Compile(RustTrains)
export function isRustTrains(action: GameAction): action is RustTrains {
    return (
        action instanceof HydratedRustTrains ||
        (action.type === 'RustTrains' && Validator.Check(action))
    )
}
export class HydratedRustTrains extends HydratableAction<typeof RustTrains> implements RustTrains {
    declare type: 'RustTrains'
    declare companyId: string
    declare metadata?: RustTrains['metadata']
    readonly #rules: TrainRules
    constructor(data: RustTrains, rules: TrainRules) {
        super(data instanceof HydratedRustTrains ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & TrainRunningState): void {
        assert(
            this.source === ActionSource.System &&
                state.routeStep?.result?.companyId === this.companyId,
            'Rusting requires the completed operating result'
        )
        const rusting = trainsRustingAfterOperation(state, this.companyId)
        const ids = rusting.map((train) => train.id)
        assert(ids.length, 'No trains rust after this operation')
        const payments = settleTrainDepartures(
            state,
            this.#rules,
            rusting.map((train) => ({
                trainId: train.id,
                definitionId: train.definitionId,
                cause: 'rust',
                owner: { kind: 'company', companyId: this.companyId }
            }))
        )
        state.trainInventory.trains = state.trainInventory.trains.map((train) =>
            ids.includes(train.id) ? unownedTrain(train, 'removed') : train
        )
        this.metadata = { trainIds: ids, ...departurePaymentsField(payments) }
    }
}
type State = HydratedGameState & TrainRunningState
export class RustingTrainsHandler implements MachineStateHandler<HydratedRustTrains, State> {
    constructor(private readonly nextState: string) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        return (
            isRustTrains(action) &&
            action.source === ActionSource.System &&
            context.gameState.routeStep?.result?.companyId === action.companyId &&
            trainsRustingAfterOperation(context.gameState, action.companyId).length > 0
        )
    }
    validActionsForPlayer(): string[] {
        return []
    }
    enter(context: MachineContext<State>): void {
        const companyId = context.gameState.routeStep?.companyId
        assert(companyId, 'Rusting requires an operating company')
        context.addSystemAction(RustTrains, {
            companyId,
            playerId: context.gameState.activePlayerIds[0]
        })
    }
    onAction(): string {
        return this.nextState
    }
}
