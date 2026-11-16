import { stateWith } from '../game/stateWith.js'
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
import {
    preparePhaseChange,
    type OperatingContinuation,
    type PhaseState
} from '../phases/phaseChange.js'
import type { FinancialState } from '../finance/finance.js'
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

/** A train taken out of the depot by an export. */
export const ExportedTrain = Type.Object(
    { trainId: Type.String(), definitionId: Type.String() },
    { additionalProperties: false }
)
export type ExportedTrain = Type.Static<typeof ExportedTrain>
/** What an export did: its trains, the phase the first of a kind started, and their payments. */
export const TrainExport = Type.Object(
    {
        trains: Type.Array(ExportedTrain),
        toPhaseId: Type.Optional(Type.String()),
        departurePayments: DeparturePayments
    },
    { additionalProperties: false }
)
export type TrainExport = Type.Static<typeof TrainExport>

const ExportFields = Type.Object({
    type: Type.Literal('ExportTrains'),
    metadata: Type.Optional(TrainExport)
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
        set.exportedRound = set.roundNumber
        this.metadata = exportDepotTrains(state, this.#trainRules, definitionIds, {
            machineState: BetweenCompaniesState
        })
    }
}

/**
 * Takes the trains out of the depot in order, each as a purchase would for the phase: the first
 * of a kind starts its phase, which resumes play in the given state once it has begun.
 */
export function exportDepotTrains(
    state: TrainState & PhaseState & FinancialState,
    trainRules: TrainRules,
    definitionIds: readonly string[],
    continuation: OperatingContinuation
): TrainExport {
    let phaseId = state.phaseId
    let phaseStarter: { trainId: string; definitionId: string } | undefined
    const trains = definitionIds.map((definitionId) => {
        const next = trainRules.phaseAfterPurchase(stateWith(state, { phaseId }), definitionId)
        const train = trainRules.depot.export(state.trainInventory, definitionId)
        if (next !== phaseId) {
            phaseId = next
            phaseStarter = { trainId: train.id, definitionId }
        }
        return { trainId: train.id, definitionId }
    })
    const payments = settleTrainDepartures(
        state,
        trainRules,
        trains.map((train) => ({ ...train, cause: 'export' }))
    )
    if (phaseStarter)
        preparePhaseChange(
            state,
            phaseStarter.trainId,
            phaseStarter.definitionId,
            phaseId,
            continuation
        )
    return {
        trains,
        ...(phaseStarter ? { toPhaseId: phaseId } : {}),
        ...departurePaymentsField(payments)
    }
}
