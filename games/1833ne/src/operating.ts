import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import {
    CashPayment,
    CompanyClosure,
    ForcedSale,
    bankExhaustionAtSetEnd,
    certificatesOwnedBy,
    closePrivate,
    closeShareCompany,
    closeZeroPriceCorporations,
    floatedCompaniesInMarketOrder,
    getCompany,
    inReceivership,
    isTreasuryPoolId,
    issueFirstTrainFunding,
    marketReceivership,
    marketShareValue,
    reorderPendingOperatingCompanies,
    sellBankruptHoldings,
    titleNames,
    type EliminationRules,
    type EndingRules,
    type HydratedEighteenXXState,
    type OperatingRules,
    type ReceivershipRules,
    type TrainFundingRules,
    type ValuationRules,
    type ZeroPriceClosureRules
} from '@tabletop/18xx'
import { Charters1833NE, Corporations1833NE, Privates1833NE } from './companies.js'
import { IssuingCorporations1833NE, Market1833NE, MarketPoolId, StockRules1833NE } from './stock.js'
import { JointTokenSource } from './track.js'
import { Phases1833NE } from './trains.js'

export const Names1833NE = titleNames(
    Object.fromEntries([
        ...Corporations1833NE.map((company) => [company.id, company.name]),
        ...Privates1833NE.map((company) => [company.id, company.name])
    ]),
    (poolId) =>
        poolId === MarketPoolId ? 'Market' : isTreasuryPoolId(poolId) ? 'Treasury' : undefined,
    {
        direct: 'Direct connection',
        interconnection: 'Interconnection',
        ferry: 'Ferry'
    }
)

export const OperatingRules1833NE: OperatingRules = {
    charters: Charters1833NE,
    roundCount: (state) => Phases1833NE.phase(state.phaseId).operatingRounds,
    // The game's first operating round runs in reverse price order; a column still runs top to
    // bottom (§4.2, §4.32), which the stable sort keeps.
    companyOrder(state) {
        const corporations = floatedCompaniesInMarketOrder(Market1833NE, state)
        const first =
            !state.operatingSet ||
            (state.operatingSet.number === 1 && state.operatingSet.roundNumber === 1)
        return first
            ? corporations.toSorted(
                  (a, b) =>
                      Market1833NE.companySpace(state.stockMarket, a).price -
                      Market1833NE.companySpace(state.stockMarket, b).price
              )
            : corporations
    }
}

/** Shares at their price; privates still with players at their printed price (§10.3). */
export const ValuationRules1833NE: ValuationRules = {
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        if (company.closed) return []
        const label = Names1833NE.company(company.id)
        if (company.kind === 'major')
            return [
                {
                    assetId: certificate.id,
                    label,
                    value: marketShareValue(Market1833NE, state, certificate)
                }
            ]
        const definition = Privates1833NE.find((entry) => entry.id === company.id)
        assertExists(definition, 'A private has a printed price')
        return certificate.owner.kind === 'player'
            ? [{ assetId: certificate.id, label, value: definition.faceValue }]
            : []
    }
}

/** The game ends after the round sequence in which the bank broke, or with one player left. */
export const EndingRules1833NE: EndingRules = {
    ...ValuationRules1833NE,
    trigger(state) {
        if (state.turnManager.turnOrder.length === 1)
            return { reason: 'All other players bankrupt' }
        if (state.companies.every((company) => company.kind !== 'major' || company.closed))
            return { reason: 'All corporations closed' }
        return bankExhaustionAtSetEnd(state)
    }
}

export const ZeroPriceClosure1833NE: ZeroPriceClosureRules<typeof CompanyClosure> = {
    market: Market1833NE,
    closure: {
        schema: CompanyClosure,
        close: (state, companyId) => closeCorporation(state, companyId)
    }
}

/**
 * Removes a closed corporation (§8.1). The shared St. Lawrence token stays on the board for
 * the other corporation.
 */
export function closeCorporation(
    state: HydratedEighteenXXState,
    companyId: string
): CompanyClosure {
    const shared = state.stations.find(
        (station) =>
            station.status === 'placed' &&
            station.companyId === companyId &&
            (state.stationAccess ?? []).some(
                (access) =>
                    access.locationId === station.position.locationId &&
                    access.nodeId === station.position.nodeId &&
                    access.companyId !== companyId
            )
    )
    const heir =
        shared?.status === 'placed'
            ? (state.stationAccess ?? []).find(
                  (access) =>
                      access.locationId === shared.position.locationId &&
                      access.nodeId === shared.position.nodeId
              )?.companyId
            : undefined
    if (shared && heir) {
        shared.companyId = heir
        state.stationAccess = state.stationAccess?.filter(
            (access) => access.companyId !== heir || access.sourceId !== JointTokenSource
        )
    }
    return closeShareCompany(state, companyId, 'removed')
}

export const BankruptcyChanges1833NE = Type.Object(
    {
        forcedSales: Type.Array(ForcedSale),
        payments: Type.Array(CashPayment),
        closedCorporations: Type.Array(CompanyClosure),
        closedPrivateIds: Type.Array(Type.String()),
        receiverCompanyIds: Type.Array(Type.String())
    },
    { additionalProperties: false }
)
export type BankruptcyChanges1833NE = Type.Static<typeof BankruptcyChanges1833NE>

/**
 * §7: a bankrupt player's stock goes to the market at its price, presidencies pass or leave
 * corporations in receivership, and the player's privates close.
 */
export const Elimination1833NE: EliminationRules<typeof BankruptcyChanges1833NE> = {
    schema: BankruptcyChanges1833NE,
    eliminate(state: HydratedEighteenXXState, playerId): BankruptcyChanges1833NE {
        const player = { kind: 'player' as const, playerId }
        const { forcedSales, payments } = sellBankruptHoldings(
            IssuingCorporations1833NE,
            state,
            playerId
        )
        const closedPrivateIds = certificatesOwnedBy(state, player)
            .filter((certificate) => certificate.kind === 'private')
            .map((certificate) => certificate.companyId)
        for (const id of closedPrivateIds) closePrivate(state, id)
        const closedCorporations = closeZeroPriceCorporations(state, Market1833NE, (companyId) =>
            closeCorporation(state, companyId)
        )
        reorderPendingOperatingCompanies(state, OperatingRules1833NE.companyOrder(state))
        return {
            forcedSales,
            payments,
            closedCorporations,
            closedPrivateIds,
            receiverCompanyIds: state.companies
                .filter((company) => inReceivership(state, company.id))
                .map((company) => company.id)
        }
    }
}

/** §§6.86–6.89. */
export const TrainFundingRules1833NE: TrainFundingRules = issueFirstTrainFunding(
    IssuingCorporations1833NE,
    {
        stockRules: StockRules1833NE,
        companyOrder: (state) => OperatingRules1833NE.companyOrder(state),
        elimination: Elimination1833NE
    }
)

/** §7.3–7.4. */
export const ReceivershipRules1833NE: ReceivershipRules = marketReceivership({
    market: Market1833NE,
    marketPoolId: MarketPoolId
})
