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
import {
    CashPayment,
    SystemActionFirstHandler,
    getCompany,
    settleCashPayments,
    type CompanyState
} from '@tabletop/18xx'
import type { EighteenThirtyTwoStateHandler } from './state.js'

const Fields = Type.Object({
    type: Type.Literal('CapitalizeCompany'),
    companyId: Type.String(),
    metadata: Type.Optional(Type.Object({ payment: CashPayment }, { additionalProperties: false }))
})
export const CapitalizeCompany: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof Fields.properties
> = Type.Object({ ...GameAction.properties, ...Fields.properties }, { additionalProperties: false })
export type CapitalizeCompany = Type.Static<typeof CapitalizeCompany>
const Validator = Compile(CapitalizeCompany)
export function isCapitalizeCompany(action: GameAction): action is CapitalizeCompany {
    return (
        action instanceof HydratedCapitalizeCompany ||
        (action.type === 'CapitalizeCompany' && Validator.Check(action))
    )
}

/** The next floated company still awaiting its ten-times-par capital (§5.6.4). */
export function companyAwaitingCapital(state: CompanyState): string | undefined {
    return state.companies.find((company) => company.floated && !company.funded && !company.closed)
        ?.id
}

export class HydratedCapitalizeCompany
    extends HydratableAction<typeof CapitalizeCompany>
    implements CapitalizeCompany
{
    declare type: 'CapitalizeCompany'
    declare companyId: string
    declare metadata?: CapitalizeCompany['metadata']
    constructor(data: CapitalizeCompany) {
        super(data instanceof HydratedCapitalizeCompany ? data.dehydrate() : data, Validator)
    }
    apply(state: HydratedGameState & CompanyState): void {
        assert(
            this.source === ActionSource.System && companyAwaitingCapital(state) === this.companyId,
            'Capital is paid to a floated company as the stock round ends'
        )
        const company = getCompany(state, this.companyId)
        assertExists(company.parPrice, 'A floated company has a par price')
        assertExists(company.shareCount, 'A floated company has a share count')
        const payment: CashPayment = {
            from: { kind: 'bank' },
            to: { kind: 'company', companyId: this.companyId },
            amount: company.parPrice * company.shareCount
        }
        settleCashPayments(state, [payment])
        company.funded = true
        this.metadata = { payment }
    }
}

/** Pays each newly floated company its capital before the operating set begins. */
export function capitalizesFloatedCompanies(
    handler: EighteenThirtyTwoStateHandler
): EighteenThirtyTwoStateHandler {
    return new SystemActionFirstHandler(handler, CapitalizeCompany, (state) => {
        const companyId = companyAwaitingCapital(state)
        return companyId ? { companyId } : undefined
    })
}
