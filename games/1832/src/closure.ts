import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, assert, assertExists } from '@tabletop/common'
import {
    BetweenCompaniesState,
    CashPayment,
    CompanyClosure,
    closeShareCompany,
    endOperatingTurn,
    finiteCashOwnedBy,
    getCompany,
    isOperatingStep,
    nextOperatingCompany,
    settleCashPayments,
    SystemActionFirstHandler
} from '@tabletop/18xx'
import type {
    EighteenThirtyTwoState,
    EighteenThirtyTwoStateHandler,
    HydratedEighteenThirtyTwoState
} from './state.js'
import { protectable } from './priceProtection.js'
import { isClosingSpace, EighteenThirtyTwoMarket } from './stockMarket.js'

/**
 * The next company whose price has entered the black area, unless its president may yet protect
 * the sale that took it there (§5.1.1).
 */
export function companyAwaitingClosure(state: EighteenThirtyTwoState): string | undefined {
    return state.companies.find(
        (company) =>
            company.kind !== 'private' &&
            company.started &&
            !company.closed &&
            isClosingSpace(EighteenThirtyTwoMarket.companySpace(state.stockMarket, company.id)) &&
            !state.priceProtection?.sales.some(
                (sale) => sale.companyId === company.id && protectable(state, sale)
            )
    )?.id
}

const Fields = Type.Object({
    type: Type.Literal('CloseCompany'),
    companyId: Type.String(),
    metadata: Type.Optional(
        Type.Object(
            {
                ...CompanyClosure.properties,
                forfeit: Type.Optional(CashPayment),
                endedTurn: Type.Boolean()
            },
            { additionalProperties: false }
        )
    )
})
export const CloseCompany: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof Fields.properties
> = Type.Object({ ...GameAction.properties, ...Fields.properties }, { additionalProperties: false })
export type CloseCompany = Type.Static<typeof CloseCompany>
const Validator = Compile(CloseCompany)
export function isCloseCompany(action: GameAction): action is CloseCompany {
    return (
        action instanceof HydratedCloseCompany ||
        (action.type === 'CloseCompany' && Validator.Check(action))
    )
}

/**
 * A closed company leaves play: its tokens, certificates and money go, its trains go to the open
 * market, and its rights and private tokens with them. Closing while funding its train, its
 * president's money is lost too; closing on its own turn ends that turn (§5.1.1, §10.6.2).
 */
export class HydratedCloseCompany
    extends HydratableAction<typeof CloseCompany>
    implements CloseCompany
{
    declare type: 'CloseCompany'
    declare companyId: string
    declare metadata?: CloseCompany['metadata']
    constructor(data: CloseCompany) {
        super(data instanceof HydratedCloseCompany ? data.dehydrate() : data, Validator)
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(
            this.source === ActionSource.System && companyAwaitingClosure(state) === this.companyId,
            'Only a company in the black area closes'
        )
        const funding = state.trainFunding?.purchase.companyId === this.companyId
        const president = getCompany(state, this.companyId).president
        const ownTurn =
            (isOperatingStep(state.machineState) || state.machineState === 'FundingTrain') &&
            nextOperatingCompany(state) === this.companyId
        const closure = closeShareCompany(state, this.companyId, 'market')
        state.coalRights = state.coalRights.filter((companyId) => companyId !== this.companyId)
        state.revenueTokens = state.revenueTokens.filter(
            (token) => token.companyId !== this.companyId
        )
        let forfeit: CashPayment | undefined
        if (funding) {
            assertExists(president, 'A company funding a train has a president')
            delete state.trainFunding
            const amount = finiteCashOwnedBy(state, president)
            if (amount) {
                forfeit = { from: president, to: { kind: 'bank' }, amount }
                settleCashPayments(state, [forfeit])
            }
        }
        if (ownTurn) {
            endOperatingTurn(state, this.companyId)
            delete state.trainPurchaseStep
            state.activePlayerIds = []
        }
        this.metadata = { ...closure, ...(forfeit ? { forfeit } : {}), endedTurn: ownTurn }
    }
}

/** Closes companies whose price entered the black area before the state does anything else. */
export function closesCompanies(
    handler: EighteenThirtyTwoStateHandler
): EighteenThirtyTwoStateHandler {
    return new SystemActionFirstHandler(
        handler,
        CloseCompany,
        (state) => {
            const companyId = companyAwaitingClosure(state)
            return companyId ? { companyId } : undefined
        },
        (state, action) =>
            isCloseCompany(action) && action.metadata?.endedTurn
                ? BetweenCompaniesState
                : state.machineState
    )
}
