import { stateWith } from '../game/stateWith.js'
import * as Type from 'typebox'
import {
    copyFinances,
    finiteCashOwnedBy,
    sameOwner,
    getCompany,
    type FinancialState,
    type President
} from '../finance/finance.js'
import { settleCashPayments } from '../finance/cashPayments.js'
import { homeStationId, sameCenter, type StationState } from '../map/station.js'
import {
    StationPlacementDetails,
    applyStationPlacement,
    type HomePosition
} from '../stations/stationPlacement.js'
import { SharePurchaseDetails, evaluateShareAcquisition } from '../stock/sharePurchase.js'
import type { StockMarketChart } from '../stock/stockMarket.js'
import type { Owner } from '../finance/finance.js'
import type { FormationState } from './companyState.js'
import type { StockRules } from '../stock/stockRules.js'
import type { CompanyRules } from './companyRules.js'

export type CompanyStartRequest = {
    playerId: string
    buyer: Owner
    companyId: string
    marketSpaceId: string
    home?: HomePosition
}
export const CompanyStartDetails = Type.Object(
    {
        ...SharePurchaseDetails.properties,
        marketSpaceId: Type.String(),
        parPrice: Type.Integer({ minimum: 1 }),
        /** The home its president placed as the company started, paid from its treasury. */
        home: Type.Optional(StationPlacementDetails)
    },
    { additionalProperties: false }
)
export type CompanyStartDetails = Type.Static<typeof CompanyStartDetails>
export type CompanyStartResult =
    { details: CompanyStartDetails; reason?: never } | { details?: never; reason: string }

export function evaluateCompanyStart(
    state: FormationState,
    request: CompanyStartRequest,
    stockRules: StockRules,
    rules: CompanyRules
): CompanyStartResult {
    const company = state.companies.find((company) => company.id === request.companyId)
    if (!company || company.started || company.closed)
        return { reason: 'This company cannot be started.' }
    if (request.buyer.kind === 'bank') return { reason: 'The Bank cannot start a company.' }
    if (!rules.startMarketSpaces(state, company.id).includes(request.marketSpaceId))
        return { reason: 'Choose an available starting price.' }
    const space = stockRules.market.spaces.find((space) => space.id === request.marketSpaceId)
    if (!space) return { reason: 'Unknown stock market space.' }
    const certificate = state.certificates.find(
        (certificate) =>
            certificate.kind === 'share' &&
            certificate.president &&
            certificate.companyId === company.id
    )
    if (!certificate) return { reason: 'The president’s certificate is unavailable.' }
    if (state.stockRound.turn.bought)
        return { reason: 'A company cannot be started after this turn’s purchase.' }
    const terms = rules.startTerms(state, company.id, request.buyer, space.id)
    if (typeof terms === 'string') return { reason: terms }
    const projected: FormationState = stateWith(state, {
        ...copyFinances(state),
        stockMarket: structuredClone(state.stockMarket)
    })
    const { home, reason } = startHome(state, request, rules)
    if (reason) return { reason }
    startCompanyAtPar(projected, stockRules.market, company.id, space.id, request.buyer)
    const result = evaluateShareAcquisition(
        projected,
        { playerId: request.playerId, buyer: request.buyer, certificateId: certificate.id },
        stockRules,
        terms
    )
    if (!result.details) return { reason: result.reason }
    const details = {
        ...result.details,
        marketSpaceId: space.id,
        parPrice: space.price,
        ...(home ? { home } : {})
    }
    if (home && treasuryAfterStart(state, details) < home.cost)
        return { reason: 'The company cannot pay for this home.' }
    return { details }
}

type StartHomeResult =
    { home?: StationPlacementDetails; reason?: never } | { home?: never; reason: string }

/** The home the request names, where the company's president chooses it as it starts. */
function startHome(
    state: FormationState,
    request: CompanyStartRequest,
    rules: CompanyRules
): StartHomeResult {
    const homes = rules.startHomes?.(state, request.companyId, request.marketSpaceId)
    if (!homes)
        return request.home ? { reason: 'This company’s home is not chosen as it starts.' } : {}
    const chosen = request.home
    if (!chosen) return { reason: 'Choose the company’s home.' }
    const home = homes.find((entry) => sameCenter(entry, chosen))
    if (!home) return { reason: 'This city cannot be the company’s home.' }
    const { cost, ...position } = home
    return {
        home: {
            companyId: request.companyId,
            stationId: homeStationId(request.companyId),
            position,
            cost
        }
    }
}

function treasuryAfterStart(state: FinancialState, details: CompanyStartDetails): number {
    const treasury = { kind: 'company' as const, companyId: details.companyId }
    const paid = details.payments
        .filter((payment) => sameOwner(payment.to, treasury))
        .reduce((sum, payment) => sum + payment.amount, 0)
    return finiteCashOwnedBy(state, treasury) + paid
}

/** Places the home chosen as the company started and pays for it from its treasury. */
export function placeStartHome(
    state: FinancialState & StationState,
    home: StationPlacementDetails
): void {
    applyStationPlacement(state, home)
    if (home.cost)
        settleCashPayments(state, [
            {
                from: { kind: 'company', companyId: home.companyId },
                to: { kind: 'bank' },
                amount: home.cost
            }
        ])
}

export function startCompanyAtPar(
    state: FormationState,
    market: StockMarketChart,
    companyId: string,
    marketSpaceId: string,
    president: President
): void {
    const company = getCompany(state, companyId)
    company.started = true
    company.parPrice = market.space(marketSpaceId).price
    company.president = president
    market.placeMarker(state.stockMarket, companyId, marketSpaceId)
}
