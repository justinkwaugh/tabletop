import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, assert, assertExists } from '@tabletop/common'
import {
    EarningsDetails,
    EarningsDistribution,
    controllingOwner,
    getCompany,
    settleCashPayments,
    endOperatingTurn,
    nextOperatingCompany,
    type EarningsRules
} from '@tabletop/18xx'
import type { HydratedEighteenFortySixState } from './state.js'

export const IndependentEarningsRules: EarningsRules = {
    choices: () => ['half-pay'],
    shareCount: () => 1,
    entitlements(state, companyId) {
        const owner = controllingOwner(state, companyId)
        assertExists(owner, 'An independent railroad has an owner')
        return [{ owner, shares: 1 }]
    },
    retainedRevenue: (_state, _companyId, _choice, revenue) => revenue / 2,
    roundDividend: (_state, _companyId, amount) => amount,
    marketEffect: () => ({ bonusPerShare: 0 })
}
const SettlementFields = Type.Object({
    type: Type.Literal('SettleIndependent'),
    source: Type.Literal(ActionSource.System),
    companyId: Type.String(),
    metadata: Type.Optional(EarningsDetails)
})
export const SettleIndependent: Type.TObject<
    Omit<typeof GameAction.properties, 'type' | 'source'> & typeof SettlementFields.properties
> = Type.Object(
    { ...GameAction.properties, ...SettlementFields.properties },
    { additionalProperties: false }
)
export const SettleIndependentValidator: ReturnType<typeof Compile<typeof SettleIndependent>> =
    Compile(SettleIndependent)
export class SettleIndependentAction extends HydratableAction<typeof SettleIndependent> {
    declare companyId: string
    declare metadata?: Type.Static<typeof EarningsDetails>
    constructor(data: Type.Static<typeof SettleIndependent>) {
        super(data, SettleIndependentValidator)
    }
    apply(state: HydratedEighteenFortySixState): void {
        assert(
            this.source === ActionSource.System &&
                state.machineState === 'SettlingIndependent' &&
                nextOperatingCompany(state) === this.companyId &&
                getCompany(state, this.companyId).kind === 'minor',
            'Only the operating independent can settle'
        )
        const evaluation = new EarningsDistribution(state, IndependentEarningsRules).evaluate(
            this.companyId,
            'half-pay'
        )
        assertExists(
            evaluation.details,
            evaluation.reason ?? 'Independent earnings require a completed run'
        )
        settleCashPayments(state, evaluation.details.payments)
        getCompany(state, this.companyId).operated = true
        this.metadata = evaluation.details
        endOperatingTurn(state, this.companyId)
        state.activePlayerIds = []
    }
}
