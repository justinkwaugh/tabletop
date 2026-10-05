import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    assertExists,
    type GameAction
} from '@tabletop/common'
import {
    ShareSale,
    ShareSaleDetails,
    applyShareSale,
    controllingOwner,
    evaluateShareDisposal,
    finiteCashOwnedBy,
    reorderPendingOperatingCompanies,
    sharesOwned,
    stockMarketSpace,
    type ShareSaleResult
} from '@tabletop/18xx'
import type { HydratedEighteenFortySixState } from './state.js'
import { emergencyFundingChoices } from './emergencyTrain.js'
import { OperatingRules1846 } from './operating.js'
import { StockRules1846 } from './stock.js'

export const EmergencyFundingFields = {
    emergencyFunding: Type.Optional(
        Type.Object(
            {
                companyId: Type.String(),
                minimumPrice: Type.Integer({ minimum: 0 }),
                soldCompanyIds: Type.Array(Type.String(), { uniqueItems: true })
            },
            { additionalProperties: false }
        )
    )
}

export function evaluateEmergencyShareSale(
    state: HydratedEighteenFortySixState,
    sale: ShareSale
): ShareSaleResult {
    const funding = state.emergencyFunding
    if (state.machineState !== 'FundingTrain' || !funding)
        return { reason: 'Personal sales require emergency train funding.' }
    if (funding.soldCompanyIds.includes(sale.companyId))
        return { reason: 'Sell each corporation’s shares in a single block.' }
    const seller = controllingOwner(state, funding.companyId)
    assertExists(seller, 'Emergency funding requires a president')
    const result = evaluateShareDisposal(state, seller, [sale], StockRules1846)
    if (!result.details) return result
    const settlement = result.details.sales[0]
    if (
        sale.companyId === funding.companyId &&
        (settlement.presidency ||
            stockMarketSpace(state.stockMarket, settlement.toMarketSpaceId).price === 0)
    )
        return { reason: 'The operating corporation must keep its president and remain open.' }
    const cash =
        finiteCashOwnedBy(state, seller) +
        finiteCashOwnedBy(state, { kind: 'company', companyId: funding.companyId })
    const minimumPrice = cash + result.details.proceeds - settlement.price + 1
    if (
        !emergencyFundingChoices(state).some(
            (choice) => choice.price > cash && choice.price >= minimumPrice
        )
    )
        return { reason: 'Do not sell more shares than a train purchase requires.' }
    return result
}

export function emergencyShareSaleChoices(
    state: HydratedEighteenFortySixState
): ShareSaleDetails[] {
    if (state.machineState !== 'FundingTrain' || !state.emergencyFunding) return []
    const seller = controllingOwner(state, state.emergencyFunding.companyId)
    assertExists(seller, 'Emergency funding requires a president')
    return state.companies.flatMap((company) =>
        Array.from({ length: sharesOwned(state, company.id, seller) }, (_, index) => {
            return evaluateEmergencyShareSale(state, { companyId: company.id, shares: index + 1 })
        }).flatMap((result) => (result.details ? [result.details] : []))
    )
}

export const SellEmergencyShares = Type.Object(
    {
        ...PlayerAction.properties,
        ...ShareSale.properties,
        type: Type.Literal('SellEmergencyShares'),
        source: Type.Literal(ActionSource.User),
        expectedProceeds: Type.Integer({ minimum: 1 }),
        metadata: Type.Optional(ShareSaleDetails)
    },
    { additionalProperties: false }
)
const Validator = Compile(SellEmergencyShares)
export function isSellEmergencyShares(
    action: GameAction
): action is Type.Static<typeof SellEmergencyShares> {
    return action.type === 'SellEmergencyShares' && Validator.Check(action)
}
export class SellEmergencySharesAction extends HydratableAction<typeof SellEmergencyShares> {
    declare companyId: string
    declare shares: number
    declare playerId: string
    declare expectedProceeds: number
    declare metadata?: Type.Static<typeof SellEmergencyShares>['metadata']
    constructor(data: Type.Static<typeof SellEmergencyShares>) {
        super(data, Validator)
    }
    isValid(state: HydratedEighteenFortySixState): boolean {
        return (
            this.source === ActionSource.User &&
            state.activePlayerIds.includes(this.playerId) &&
            !!state.emergencyFunding &&
            controllingOwner(state, state.emergencyFunding.companyId)?.playerId === this.playerId &&
            evaluateEmergencyShareSale(state, { companyId: this.companyId, shares: this.shares })
                .details?.proceeds === this.expectedProceeds
        )
    }
    apply(state: HydratedEighteenFortySixState): void {
        assert(this.isValid(state), 'Invalid emergency share sale')
        const details = evaluateEmergencyShareSale(state, {
            companyId: this.companyId,
            shares: this.shares
        }).details
        const funding = state.emergencyFunding
        assertExists(details, 'Emergency share sale requires settlement terms')
        assertExists(funding, 'Emergency share sale requires funding')
        applyShareSale(state, details)
        funding.minimumPrice = Math.max(
            funding.minimumPrice,
            finiteCashOwnedBy(state, details.seller) +
                finiteCashOwnedBy(state, { kind: 'company', companyId: funding.companyId }) -
                details.sales[0].price +
                1
        )
        funding.soldCompanyIds.push(this.companyId)
        reorderPendingOperatingCompanies(state, OperatingRules1846.companyOrder(state))
        this.metadata = details
    }
}
