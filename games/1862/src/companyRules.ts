import {
    addCompanyStations,
    fullCapitalizationPayments,
    getCompany,
    homeStationId,
    settleCashPayments,
    sharesStillToFloat,
    type CompanyRules,
    type FormationState
} from '@tabletop/18xx'
import { Charters1862, DirectorShares } from './charters.js'
import { homeAvailable, homeHasRoom } from './homes.js'
import { IpoPoolId, charterPoolId } from './pools.js'
import { Companies1862 } from './companies.js'
import { requireState1862 } from './state.js'
import {
    Market1862,
    NonCharteredParPrices,
    NonCharteredStartPrices,
    marketSpaceIdAt
} from './stockMarket.js'
import { recordStockPurchase } from './stockRules.js'
import { Phases1862 } from './trains.js'

export const CharteredStationCost = 60
export const NonCharteredStationCost = 40
export const CharteredStations = 3

export function isChartered(state: object, companyId: string): boolean {
    return requireState1862(state).chartered.includes(companyId)
}

/** Whether an unstarted company may be started now: available, and with room for its home (§3.2). */
export function canStart(state: FormationState, companyId: string): boolean {
    const title = requireState1862(state)
    const company = getCompany(state, companyId)
    const availability = title.availability[companyId]
    // A company reset for a missed obligation returns from the next stock round on (§4.3).
    if (title.resetCompanyIds?.includes(companyId)) return false
    return (
        !company.started &&
        !company.closed &&
        !title.lner &&
        !!availability &&
        Phases1862.isAtLeast(state.phaseId, availability) &&
        homeAvailable(title, companyId)
    )
}

/** The companies dealt out of the game: those never given a time to become available (§2.4.1). */
export function outOfPlayCompanyIds(state: object): string[] {
    const { availability } = requireState1862(state)
    return Companies1862.map((company) => company.id).filter((id) => !(id in availability))
}

/** A non-chartered company's par: the highest non-chartered par at or below its price (§6.5.3). */
export function nonCharteredPar(price: number): number {
    return Math.max(...NonCharteredParPrices.filter((par) => par <= price))
}

/** Gives the company its stations, the home first, paying for them from its treasury. */
export function buyStations(
    state: FormationState,
    companyId: string,
    count: number,
    cost: number
): void {
    // A restarted company takes back its home station; its others were lost as it reset.
    const homeId = homeStationId(companyId)
    if (state.stations.some((station) => station.id === homeId))
        state.stations = state.stations.map((station) =>
            station.id === homeId ? { id: homeId, companyId, status: 'available' } : station
        )
    else addCompanyStations(state, companyId, 1)
    addCompanyStations(state, companyId, count - 1)
    settleCashPayments(state, [
        { from: { kind: 'company', companyId }, to: { kind: 'bank' }, amount: count * cost }
    ])
}

export const CompanyRules1862: CompanyRules = {
    // A company started in a stock round is non-chartered: its director chooses a price in the
    // pink or yellow zones, 54 to 200. Its home hex must be empty or have a free space now; an
    // upgrade to come is not enough (§6.5.3).
    startMarketSpaces: (state, companyId) =>
        canStart(state, companyId) && homeHasRoom(requireState1862(state), companyId)
            ? NonCharteredStartPrices.map(marketSpaceIdAt)
            : [],
    // The director pays three times the price to the company (§6.5.3).
    startTerms: (_state, companyId, buyer, spaceId) => ({
        price: Market1862.space(spaceId).price * DirectorShares,
        recipient: { kind: 'company', companyId },
        payers: [buyer]
    }),
    // Its other shares go onto its charter, sold at market price for the company (§6.5.3).
    onStart(state, details) {
        const company = getCompany(state, details.companyId)
        company.parPrice = nonCharteredPar(details.parPrice)
        for (const certificate of state.certificates)
            if (certificate.companyId === details.companyId && certificate.poolId === IpoPoolId) {
                certificate.owner = { kind: 'company', companyId: details.companyId }
                certificate.poolId = charterPoolId(details.companyId)
            }
        recordStockPurchase(state, details.buyer, details.companyId, details.shares)
    },
    // Half the shares bought from the IPO or the company floats it (§6.5.4).
    flotationPayments(state, companyId) {
        const remaining = sharesStillToFloat(
            state,
            Charters1862,
            companyId,
            50,
            (certificate) =>
                certificate.poolId === IpoPoolId || certificate.poolId === charterPoolId(companyId)
        )
        if (isChartered(state, companyId))
            return fullCapitalizationPayments(state, Charters1862, companyId, remaining)
        return remaining === 0 ? [] : undefined
    },
    // A chartered company buys three stations at £60; a non-chartered company's director chooses
    // how many it buys (§6.5.4.2).
    onFloat(state, companyId) {
        const title = requireState1862(state)
        // Floating meets the charter's obligation (§4.3).
        title.obligations = title.obligations.filter((entry) => entry.companyId !== companyId)
        if (isChartered(state, companyId))
            buyStations(state, companyId, CharteredStations, CharteredStationCost)
        else title.stationPurchase = companyId
    }
}
