import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    type HydratedGameState
} from '@tabletop/common'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { privateOwner, type FinancialState } from '../finance/finance.js'
import {
    OperatingSet,
    nextOperatingCompany,
    type OperatingState,
    type OperatingRules
} from './operatingSet.js'

const Fields = Type.Object({
    type: Type.Literal('StartOperatingRound'),
    metadata: Type.Optional(
        Type.Object(
            { operatingSet: OperatingSet, payments: Type.Array(CashPayment) },
            { additionalProperties: false }
        )
    )
})
export const StartOperatingRound: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof Fields.properties
> = Type.Object({ ...GameAction.properties, ...Fields.properties }, { additionalProperties: false })
export type StartOperatingRound = Type.Static<typeof StartOperatingRound>
const Validator = Compile(StartOperatingRound)
export function isStartOperatingRound(action: GameAction): action is StartOperatingRound {
    return (
        action instanceof HydratedStartOperatingRound ||
        (action.type === 'StartOperatingRound' && Validator.Check(action))
    )
}
export function canStartOperatingRound(state: OperatingState): boolean {
    const set = state.operatingSet
    return (
        !!set &&
        !set.completed &&
        (!set.privateIncomePaid ||
            (!nextOperatingCompany(state) && set.roundNumber < set.roundCount))
    )
}
export class HydratedStartOperatingRound
    extends HydratableAction<typeof StartOperatingRound>
    implements StartOperatingRound
{
    declare type: 'StartOperatingRound'
    declare metadata?: StartOperatingRound['metadata']
    readonly #rules: OperatingRules
    constructor(data: StartOperatingRound, rules: OperatingRules) {
        super(data instanceof HydratedStartOperatingRound ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & OperatingState): void {
        assert(
            this.source === ActionSource.System && canStartOperatingRound(state),
            'The next operating round is not ready'
        )
        const set = state.operatingSet!
        const payments = privateIncomePayments(state)
        settleCashPayments(state, payments)
        if (set.privateIncomePaid) set.roundNumber++
        set.companyOrder = this.#rules.companyOrder(state)
        set.completedCompanyIds = []
        set.privateIncomePaid = true
        this.metadata = { operatingSet: structuredClone(set), payments }
    }
}

export function privateIncomePayments(state: FinancialState): CashPayment[] {
    return state.companies.flatMap((company) => {
        if (company.closed || company.kind !== 'private' || !company.privateRevenue) return []
        const owner = privateOwner(state, company.id)
        return owner && owner.kind !== 'bank'
            ? [
                  {
                      from: { kind: 'bank' } as const,
                      to: { ...owner },
                      amount: company.privateRevenue
                  }
              ]
            : []
    })
}
