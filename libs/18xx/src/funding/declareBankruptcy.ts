import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    type HydratedGameState
} from '@tabletop/common'
import { EmergencyTrainFunding, type FundingState, type TrainFundingRules } from './trainFunding.js'
import type { StockRules } from '../stock/stockRules.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import { Bankruptcy } from './trainFunding.js'

const BankruptcyActionFields = Type.Object({
    type: Type.Literal('DeclareBankruptcy'),
    metadata: Type.Optional(Bankruptcy)
})
export const DeclareBankruptcy: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof BankruptcyActionFields.properties
> = Type.Object(
    { ...GameAction.properties, ...BankruptcyActionFields.properties },
    { additionalProperties: false }
)

export type DeclareBankruptcy = Type.Static<typeof DeclareBankruptcy>
const DeclareBankruptcyValidator = Compile(DeclareBankruptcy)
export function isDeclareBankruptcy(action: GameAction): action is DeclareBankruptcy {
    return (
        action instanceof HydratedDeclareBankruptcy ||
        (action.type === 'DeclareBankruptcy' && DeclareBankruptcyValidator.Check(action))
    )
}
export class HydratedDeclareBankruptcy
    extends HydratableAction<typeof DeclareBankruptcy>
    implements DeclareBankruptcy
{
    declare type: 'DeclareBankruptcy'
    declare metadata?: Bankruptcy
    readonly #rules: TrainFundingRules
    readonly #stocks: StockRules
    readonly #trains: TrainRules
    constructor(
        data: DeclareBankruptcy,
        rules: TrainFundingRules,
        stocks: StockRules,
        trains: TrainRules
    ) {
        super(
            data instanceof HydratedDeclareBankruptcy ? data.dehydrate() : data,
            DeclareBankruptcyValidator
        )
        this.#rules = rules
        this.#stocks = stocks
        this.#trains = trains
    }
    isValid(state: FundingState): boolean {
        const funding = new EmergencyTrainFunding(state, this.#rules, this.#stocks, this.#trains)
        if (state.machineState !== 'FundingTrain' || !state.trainFunding) return false
        return this.source === ActionSource.System && funding.next().kind === 'bankrupt'
    }
    apply(state: HydratedGameState & FundingState): void {
        assert(this.isValid(state), 'Invalid DeclareBankruptcy action')
        const funding = new EmergencyTrainFunding(state, this.#rules, this.#stocks, this.#trains)
        const next = funding.next()
        assert(
            next.kind === 'bankrupt' && state.trainFunding,
            'Bankruptcy requires exhausted funding'
        )
        state.bankruptcy = {
            companyId: state.trainFunding.purchase.companyId,
            playerId: state.trainFunding.playerId,
            shortfall: next.shortfall
        }
        this.metadata = state.bankruptcy
    }
}
