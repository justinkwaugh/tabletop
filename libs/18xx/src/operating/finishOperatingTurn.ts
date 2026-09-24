import { OperatingRoundSnapshot, operatingRoundSnapshot } from './operatingRoundSnapshot.js'
import type { ValuationRules } from '../ending/finalWealth.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type HydratedGameState,
    type GameAction
} from '@tabletop/common'
import { controllingOwner } from '../finance/finance.js'
import type { DistributionState } from '../earnings/earningsDistribution.js'
import type { ConstructionState } from '../construction/trackConstruction.js'
import type { StationPlacementState } from '../stations/stationPlacement.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import { trainsOwnedBy } from '../trains/train.js'
import { nextOperatingCompany, type OperatingState } from './operatingSet.js'

export type OperatingTurnState = OperatingState &
    DistributionState &
    ConstructionState &
    StationPlacementState
export function finishOperatingTurnReason(
    state: OperatingTurnState,
    rules: TrainRules,
    companyId: string
): string | undefined {
    if (
        !state.operatingSet ||
        state.operatingSet.completed ||
        nextOperatingCompany(state) !== companyId ||
        state.trainPurchaseStep?.companyId !== companyId
    )
        return 'This company is not finishing its operating turn.'
    if (
        !trainsOwnedBy(state, { kind: 'company', companyId }).length &&
        rules.requiresTrain(state, companyId)
    )
        return 'This company must buy a train because its station connects to another revenue center.'
    return undefined
}
export const FinishOperatingTurn = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('FinishOperatingTurn'),
        companyId: Type.String(),
        metadata: Type.Optional(OperatingRoundSnapshot)
    },
    { additionalProperties: false }
)
export type FinishOperatingTurn = Type.Static<typeof FinishOperatingTurn>
const Validator = Compile(FinishOperatingTurn)
export function isFinishOperatingTurn(action: GameAction): action is FinishOperatingTurn {
    return (
        action instanceof HydratedFinishOperatingTurn ||
        (action.type === 'FinishOperatingTurn' && Validator.Check(action))
    )
}
export class HydratedFinishOperatingTurn
    extends HydratableAction<typeof FinishOperatingTurn>
    implements FinishOperatingTurn
{
    declare type: 'FinishOperatingTurn'
    declare metadata?: OperatingRoundSnapshot
    declare companyId: string
    declare playerId: string
    readonly #rules: TrainRules
    readonly #valuationRules: ValuationRules
    constructor(data: FinishOperatingTurn, rules: TrainRules, valuationRules: ValuationRules) {
        super(data instanceof HydratedFinishOperatingTurn ? data.dehydrate() : data, Validator)
        this.#rules = rules
        this.#valuationRules = valuationRules
    }
    apply(state: HydratedGameState & OperatingTurnState): void {
        assert(
            (this.source === ActionSource.User || this.source === ActionSource.System) &&
                state.activePlayerIds.includes(this.playerId) &&
                controllingOwner(state, this.companyId)?.playerId === this.playerId,
            'Only the operating company’s controlling owner may finish its turn'
        )
        const reason = finishOperatingTurnReason(state, this.#rules, this.companyId)
        assert(!reason, reason ?? 'Cannot finish operating turn')
        state.operatingSet!.completedCompanyIds.push(this.companyId)
        state.turnManager.endTurn(state.actionCount)
        delete state.trackStep
        delete state.stationStep
        delete state.routeStep
        delete state.earningsDistribution
        this.metadata = operatingRoundSnapshot(state, this.#valuationRules)
        delete state.trainPurchaseStep
    }
}
