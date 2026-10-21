import * as Type from 'typebox'
import { copyFinances, getCompany, type President } from '../finance/finance.js'
import { SharePurchaseDetails, evaluateShareAcquisition } from '../stock/sharePurchase.js'
import type { StockMarketChart } from '../stock/stockMarket.js'
import type { Owner } from '../finance/finance.js'
import type { FormationState } from './companyState.js'
import type { StockRules } from '../stock/stockRules.js'
import type { CompanyRules, HomeOption } from './companyRules.js'
import type { MapStateData } from '../map/mapState.js'

export type CompanyStartRequest = {
    playerId: string
    buyer: Owner
    companyId: string
    marketSpaceId: string
    /** The home chosen for a company whose title offers home choices. */
    homeLocationId?: string
}
export const CompanyHome = Type.Object(
    { locationId: Type.String(), nodeId: Type.Optional(Type.String()) },
    { additionalProperties: false }
)
export const CompanyStartDetails = Type.Object(
    {
        ...SharePurchaseDetails.properties,
        marketSpaceId: Type.String(),
        parPrice: Type.Integer({ minimum: 1 }),
        home: Type.Optional(CompanyHome)
    },
    { additionalProperties: false }
)
export type CompanyStartDetails = Type.Static<typeof CompanyStartDetails>
export type CompanyStartResult =
    { details: CompanyStartDetails; reason?: never } | { details?: never; reason: string }

/** The homes a company may start with: its choices, or none to choose when its home is printed. */
export function companyHomeOptions(
    state: FormationState & MapStateData,
    rules: CompanyRules,
    companyId: string
): readonly HomeOption[] | undefined {
    return rules.homeChoices?.(state, companyId)
}

/** The home locations a start may name: each choice, or none for a printed home. */
export function startHomeLocationIds(
    state: FormationState & MapStateData,
    rules: CompanyRules,
    companyId: string
): (string | undefined)[] {
    const homes = companyHomeOptions(state, rules, companyId)
    return homes ? homes.map((home) => home.locationId) : [undefined]
}

export function evaluateCompanyStart(
    state: FormationState & MapStateData,
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
    const homes = companyHomeOptions(state, rules, company.id)
    const home = homes?.find((option) => option.locationId === request.homeLocationId)
    if (homes && !home) return { reason: 'Choose a home for the company.' }
    if (!homes && request.homeLocationId !== undefined)
        return { reason: 'This company’s home is printed on the map.' }
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
    const projected: FormationState = {
        ...state,
        ...copyFinances(state),
        stockMarket: structuredClone(state.stockMarket)
    }
    startCompanyAtPar(projected, stockRules.market, company.id, space.id, request.buyer)
    const result = evaluateShareAcquisition(
        projected,
        { playerId: request.playerId, buyer: request.buyer, certificateId: certificate.id },
        stockRules,
        terms
    )
    return result.details
        ? {
              details: {
                  ...result.details,
                  marketSpaceId: space.id,
                  parPrice: space.price,
                  ...(home ? { home: { ...home } } : {})
              }
          }
        : { reason: result.reason }
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
