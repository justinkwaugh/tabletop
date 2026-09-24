import * as Type from 'typebox'
import { copyFinances, getCompany } from '../finance/finance.js'
import { SharePurchaseDetails, evaluateShareAcquisition } from '../stock/sharePurchase.js'
import { placeStockMarker } from '../stock/stockMarket.js'
import type { Owner } from '../finance/finance.js'
import type { FormationState } from './companyState.js'
import type { StockRules } from '../stock/stockRules.js'
import type { CompanyRules } from './companyRules.js'

export type CompanyStartRequest = {
    playerId: string
    buyer: Owner
    companyId: string
    marketSpaceId: string
}
export const CompanyStartDetails = Type.Object(
    {
        ...SharePurchaseDetails.properties,
        marketSpaceId: Type.String(),
        parPrice: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
)
export type CompanyStartDetails = Type.Static<typeof CompanyStartDetails>
export type CompanyStartResult =
    | { details: CompanyStartDetails; reason?: never }
    | { details?: never; reason: string }

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
    const space = state.stockMarket.spaces.find((space) => space.id === request.marketSpaceId)
    if (!space) return { reason: 'Unknown stock market space.' }
    const certificate = state.certificates.find(
        (certificate) =>
            !certificate.retired &&
            certificate.kind === 'share' &&
            certificate.president &&
            certificate.companyId === company.id
    )
    if (!certificate || certificate.retired)
        return { reason: 'The president’s certificate is unavailable.' }
    const terms = rules.startTerms(state, company.id, request.buyer, space.id)
    if (typeof terms === 'string') return { reason: terms }
    const projected: FormationState = {
        ...state,
        ...copyFinances(state),
        stockMarket: {
            spaces: state.stockMarket.spaces,
            stacks: structuredClone(state.stockMarket.stacks)
        }
    }
    const started = getCompany(projected, company.id)
    started.started = true
    started.parPrice = space.price
    started.president = request.buyer
    placeStockMarker(projected.stockMarket, company.id, space.id)
    const result = evaluateShareAcquisition(
        projected,
        { playerId: request.playerId, buyer: request.buyer, certificateId: certificate.id },
        stockRules,
        terms
    )
    return result.details
        ? { details: { ...result.details, marketSpaceId: space.id, parPrice: space.price } }
        : { reason: result.reason }
}
