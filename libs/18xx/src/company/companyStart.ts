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
import {
    SharePurchaseDetails,
    applyShareTransfer,
    evaluateShareAcquisition,
    evaluateShareTransfer
} from '../stock/sharePurchase.js'
import type { StockMarketChart } from '../stock/stockMarket.js'
import type { Owner } from '../finance/finance.js'
import type { FormationState } from './companyState.js'
import type { StockRules } from '../stock/stockRules.js'
import type { CompanyRules, StartHomeClaim } from './companyRules.js'

export type CompanyStartRequest = {
    playerId: string
    buyer: Owner
    companyId: string
    marketSpaceId: string
    home?: HomePosition
    /** Ordinary certificates the president buys with the start, where the title allows (1849 §9.4). */
    additionalCertificateIds?: readonly string[]
}
export const CompanyStartDetails = Type.Object(
    {
        ...SharePurchaseDetails.properties,
        marketSpaceId: Type.String(),
        parPrice: Type.Integer({ minimum: 1 }),
        /** The home its president placed or claimed as the company started. */
        home: Type.Optional(StationPlacementDetails),
        /** The home is only claimed, on its city or hex, until the company first operates. */
        homeClaim: Type.Optional(Type.Union([Type.Literal('city'), Type.Literal('hex')])),
        /** Ordinary certificates bought with the president's, in the order they were bought. */
        additionalPurchases: Type.Optional(Type.Array(SharePurchaseDetails))
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
    const { home, homeClaim, reason } = startHome(state, request, rules)
    if (reason) return { reason }
    startCompanyAtPar(projected, stockRules.market, company.id, space.id, request.buyer)
    const result = evaluateShareAcquisition(
        projected,
        { playerId: request.playerId, buyer: request.buyer, certificateId: certificate.id },
        stockRules,
        terms
    )
    if (!result.details) return { reason: result.reason }
    const additional = additionalStartPurchases(
        projected,
        request,
        result.details,
        stockRules,
        rules
    )
    if (typeof additional === 'string') return { reason: additional }
    const details = {
        ...result.details,
        marketSpaceId: space.id,
        parPrice: space.price,
        ...(home ? { home } : {}),
        ...(homeClaim ? { homeClaim } : {}),
        ...(additional.length ? { additionalPurchases: additional } : {})
    }
    if (home && treasuryAfterStart(state, details) < home.cost)
        return { reason: 'The company cannot pay for this home.' }
    return { details }
}

/** The further certificates a start buys, each on the state the purchases before it leave. */
function additionalStartPurchases(
    projected: FormationState,
    request: CompanyStartRequest,
    president: SharePurchaseDetails,
    stockRules: StockRules,
    rules: CompanyRules
): SharePurchaseDetails[] | string {
    const ids = request.additionalCertificateIds ?? []
    if (!ids.length) return []
    if (ids.length > (rules.additionalStartCertificates?.(projected, request.companyId) ?? 0))
        return 'The start cannot include this many further certificates.'
    if (new Set(ids).size !== ids.length) return 'A certificate can only be bought once.'
    applyShareTransfer(projected, president)
    const purchases: SharePurchaseDetails[] = []
    for (const certificateId of ids) {
        const certificate = projected.certificates.find((entry) => entry.id === certificateId)
        if (
            !certificate ||
            certificate.kind !== 'share' ||
            certificate.president ||
            certificate.companyId !== request.companyId
        )
            return 'Only the company’s ordinary certificates can be bought with its start.'
        const purchase = evaluateShareTransfer(
            projected,
            { playerId: request.playerId, buyer: request.buyer, certificateId },
            stockRules,
            stockRules.purchaseTerms(projected, certificate, request.buyer)
        )
        if (!purchase.details) return purchase.reason
        applyShareTransfer(projected, purchase.details)
        purchases.push(purchase.details)
    }
    return purchases
}

type StartHomeResult =
    | { home?: StationPlacementDetails; homeClaim?: StartHomeClaim; reason?: never }
    | { home?: never; homeClaim?: never; reason: string }

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
    const { cost, claims, ...position } = home
    return {
        home: {
            companyId: request.companyId,
            stationId: homeStationId(request.companyId),
            position,
            cost
        },
        ...(claims ? { homeClaim: claims } : {})
    }
}

function treasuryAfterStart(state: FinancialState, details: CompanyStartDetails): number {
    const treasury = { kind: 'company' as const, companyId: details.companyId }
    const paid = [
        ...details.payments,
        ...(details.additionalPurchases ?? []).flatMap((purchase) => purchase.payments)
    ]
        .filter((payment) => sameOwner(payment.to, treasury))
        .reduce((sum, payment) => sum + payment.amount, 0)
    return finiteCashOwnedBy(state, treasury) + paid
}

/** Reserves the home chosen as the company started, which it places as it first operates. */
export function claimStartHome(
    state: StationState,
    { companyId, position: { locationId, nodeId } }: StationPlacementDetails,
    claim: StartHomeClaim
): void {
    if (claim === 'city') state.stationReservations.push({ companyId, locationId, nodeId })
    else state.hexReservations = [...(state.hexReservations ?? []), { companyId, locationId }]
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
