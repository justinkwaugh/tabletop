import { Market1846 } from './stock.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    assertExists
} from '@tabletop/common'
import {
    CashPayment,
    certificatesOwnedBy,
    certificatesInPool,
    nextOperatingCompany,
    getCompany,
    controllingOwner,
    finiteCashOwnedBy,
    settleCashPayments,
    type FinancialState
} from '@tabletop/18xx'
import type { HydratedEighteenFortySixState } from './state.js'

const FinanceOperation = Type.Union([Type.Literal('issue'), Type.Literal('redeem')])
const FinanceChoice = Type.Object(
    {
        companyId: Type.String(),
        operation: FinanceOperation,
        shares: Type.Integer({ minimum: 1 }),
        amount: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type FinanceChoice = Type.Static<typeof FinanceChoice>

/** The direction a corporation committed to this turn: it may not both issue and redeem. */
export const FinanceStep = Type.Object(
    { companyId: Type.String(), operation: FinanceOperation },
    { additionalProperties: false }
)
export type FinanceStep = Type.Static<typeof FinanceStep>

// Rules §6.2 order issuing first, but nothing before the run changes its price (§6.33), limits
// or payout (§6.73), so a president may issue or redeem at any point until routes are run.
const CorporateFinanceStates: readonly string[] = ['LayingTrack', 'RunningTrains']

export function corporateFinanceCertificates(
    state: FinancialState,
    companyId: string,
    operation: 'issue' | 'redeem'
) {
    const certificates =
        operation === 'issue'
            ? certificatesOwnedBy(state, { kind: 'company', companyId })
            : certificatesInPool(state, 'open-market')
    return certificates.filter((certificate) => certificate.companyId === companyId)
}

export function corporateIssueLimit(state: FinancialState, companyId: string): number {
    const treasury = corporateFinanceCertificates(state, companyId, 'issue')
    const market = corporateFinanceCertificates(state, companyId, 'redeem')
    const playerShares = state.certificates.reduce(
        (total, certificate) =>
            total +
            (certificate.companyId === companyId &&
            certificate.kind === 'share' &&
            certificate.owner.kind === 'player'
                ? certificate.shares
                : 0),
        0
    )
    return Math.max(0, Math.min(treasury.length, playerShares - market.length))
}

export function corporateFinanceChoices(state: HydratedEighteenFortySixState): FinanceChoice[] {
    if (!CorporateFinanceStates.includes(state.machineState)) return []
    const companyId = nextOperatingCompany(state)
    assertExists(companyId, 'Corporate finance requires an operating company')
    const company = getCompany(state, companyId)
    if (company.kind !== 'major') return []
    assert(
        !company.closed && company.floated,
        'Corporate finance requires an open, floated major corporation'
    )
    const committed =
        state.financeStep?.companyId === companyId ? state.financeStep.operation : undefined
    const market = corporateFinanceCertificates(state, companyId, 'redeem')
    const space = Market1846.companySpace(state.stockMarket, companyId)
    assertExists(space.moves.left, 'An operating corporation has an issuance price')
    const issuePrice = Market1846.space(space.moves.left).price
    const redemptionSpaceId = space.price === 550 ? space.id : space.moves.right
    assertExists(redemptionSpaceId, 'An operating corporation has a redemption price')
    const redeemPrice = space.price === 550 ? 600 : Market1846.space(redemptionSpaceId).price
    const issueLimit = committed === 'redeem' ? 0 : corporateIssueLimit(state, companyId)
    const redeemLimit =
        committed === 'issue'
            ? 0
            : Math.min(
                  market.length,
                  Math.floor(finiteCashOwnedBy(state, { kind: 'company', companyId }) / redeemPrice)
              )
    return [
        ...Array.from({ length: Math.max(0, issueLimit) }, (_, i): FinanceChoice => ({
            companyId,
            operation: 'issue',
            shares: i + 1,
            amount: (i + 1) * issuePrice
        })),
        ...Array.from({ length: redeemLimit }, (_, i): FinanceChoice => ({
            companyId,
            operation: 'redeem',
            shares: i + 1,
            amount: (i + 1) * redeemPrice
        }))
    ]
}
export const CorporateFinance = Type.Object(
    {
        ...PlayerAction.properties,
        ...FinanceChoice.properties,
        type: Type.Literal('CorporateFinance'),
        source: Type.Literal(ActionSource.User),
        metadata: Type.Optional(
            Type.Object(
                {
                    ...FinanceChoice.properties,
                    certificateIds: Type.Array(Type.String()),
                    payments: Type.Array(CashPayment)
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export const CorporateFinanceValidator = Compile(CorporateFinance)
export class CorporateFinanceAction extends HydratableAction<typeof CorporateFinance> {
    declare playerId: string
    declare companyId: string
    declare operation: FinanceChoice['operation']
    declare shares: number
    declare amount: number
    declare metadata?: Type.Static<typeof CorporateFinance>['metadata']
    constructor(data: Type.Static<typeof CorporateFinance>) {
        super(data, CorporateFinanceValidator)
    }
    isValid(state: HydratedEighteenFortySixState): boolean {
        return (
            this.source === ActionSource.User &&
            state.activePlayerIds.includes(this.playerId) &&
            nextOperatingCompany(state) === this.companyId &&
            controllingOwner(state, this.companyId)?.playerId === this.playerId &&
            corporateFinanceChoices(state).some(
                (c) =>
                    c.companyId === this.companyId &&
                    c.operation === this.operation &&
                    c.shares === this.shares &&
                    c.amount === this.amount
            )
        )
    }
    apply(state: HydratedEighteenFortySixState): void {
        assert(this.isValid(state), 'Invalid corporate share transaction')
        const company = { kind: 'company' as const, companyId: this.companyId }
        const bank = { kind: 'bank' as const }
        const issuing = this.operation === 'issue'
        const certificates = corporateFinanceCertificates(
            state,
            this.companyId,
            this.operation
        ).slice(0, this.shares)
        const payments: CashPayment[] = this.amount
            ? [
                  {
                      from: issuing ? bank : company,
                      to: issuing ? company : bank,
                      amount: this.amount
                  }
              ]
            : []
        settleCashPayments(state, payments)
        for (const certificate of certificates) {
            certificate.owner = issuing ? bank : company
            if (issuing) certificate.poolId = 'open-market'
            else delete certificate.poolId
        }
        state.financeStep = { companyId: this.companyId, operation: this.operation }
        this.metadata = {
            companyId: this.companyId,
            operation: this.operation,
            shares: this.shares,
            amount: this.amount,
            certificateIds: certificates.map((c) => c.id),
            payments
        }
    }
}
