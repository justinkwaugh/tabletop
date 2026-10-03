import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    assertExists,
    type HydratedGameState
} from '@tabletop/common'
import type { TrainState } from '../trains/train.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import { preparePhaseChange, type PhaseState } from '../phases/phaseChange.js'
import { nextOperatingCompany, type OperatingRules, type OperatingState } from './operatingSet.js'
import { BetweenCompaniesState } from './operatingSteps.js'
import {
    DeparturePayments,
    departurePaymentsField,
    settleTrainDepartures
} from '../trains/trainDepartures.js'

type State = OperatingState & TrainState & PhaseState

export function trainsAwaitingExport(state: State, rules: OperatingRules): string[] {
    const set = state.operatingSet
    if (
        !rules.trainsToExport ||
        !set ||
        set.completed ||
        !set.privateIncomePaid ||
        nextOperatingCompany(state) ||
        set.exportedRound === set.roundNumber
    )
        return []
    return rules.trainsToExport(state)
}

const ExportFields = Type.Object({
    type: Type.Literal('ExportTrains'),
    metadata: Type.Optional(
        Type.Object(
            {
                trains: Type.Array(
                    Type.Object(
                        { trainId: Type.String(), definitionId: Type.String() },
                        { additionalProperties: false }
                    )
                ),
                toPhaseId: Type.Optional(Type.String()),
                departurePayments: DeparturePayments
            },
            { additionalProperties: false }
        )
    )
})
export const ExportTrains: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof ExportFields.properties
> = Type.Object(
    { ...GameAction.properties, ...ExportFields.properties },
    { additionalProperties: false }
)
export type ExportTrains = Type.Static<typeof ExportTrains>
const Validator = Compile(ExportTrains)
export function isExportTrains(action: GameAction): action is ExportTrains {
    return (
        action instanceof HydratedExportTrains ||
        (action.type === 'ExportTrains' && Validator.Check(action))
    )
}

export class HydratedExportTrains
    extends HydratableAction<typeof ExportTrains>
    implements ExportTrains
{
    declare type: 'ExportTrains'
    declare metadata?: ExportTrains['metadata']
    readonly #operatingRules: OperatingRules
    readonly #trainRules: TrainRules
    constructor(data: ExportTrains, operatingRules: OperatingRules, trainRules: TrainRules) {
        super(data instanceof HydratedExportTrains ? data.dehydrate() : data, Validator)
        this.#operatingRules = operatingRules
        this.#trainRules = trainRules
    }
    apply(state: HydratedGameState & State): void {
        assert(this.source === ActionSource.System, 'Exports are a system action')
        const definitionIds = trainsAwaitingExport(state, this.#operatingRules)
        assert(definitionIds.length > 0, 'No trains are awaiting export')
        const set = state.operatingSet
        assertExists(set, 'Exports follow an operating round')
        let phaseId = state.phaseId
        let phaseStarter: { trainId: string; definitionId: string } | undefined
        const trains = definitionIds.map((definitionId) => {
            const next = this.#trainRules.phaseAfterPurchase({ ...state, phaseId }, definitionId)
            const train = this.#trainRules.depot.export(state.trainInventory, definitionId)
            if (next !== phaseId) {
                phaseId = next
                phaseStarter = { trainId: train.id, definitionId }
            }
            return { trainId: train.id, definitionId }
        })
        const payments = settleTrainDepartures(
            state,
            this.#trainRules,
            trains.map((train) => ({ ...train, cause: 'export' }))
        )
        set.exportedRound = set.roundNumber
        if (phaseStarter)
            preparePhaseChange(state, phaseStarter.trainId, phaseStarter.definitionId, phaseId, {
                machineState: BetweenCompaniesState
            })
        this.metadata = {
            trains,
            ...(phaseStarter ? { toPhaseId: phaseId } : {}),
            ...departurePaymentsField(payments)
        }
    }
}
