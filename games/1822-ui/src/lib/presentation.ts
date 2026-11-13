import {
    EnglishChannelLocationId,
    LnwrId,
    LondonLocationId,
    Map1822,
    MarketPoolId1822,
    MarketZoneColors1822,
    PhaseCreditPrivateIds,
    RiverDiscountPrivateId,
    TitleRules1822,
    isAcquireMinor,
    isAcquirePrivate,
    isPlaceMetropolitanHome,
    isReachDestination,
    major1822,
    type State1822
} from '@tabletop/1822'
import { finiteCashOwnedBy, getCompany, privateOwner, privateOwningCompany } from '@tabletop/18xx'
import { moneyFormat, type TitleFact, type TitlePresentation } from '@tabletop/18xx-ui'
import { CompanyNames1822 } from './companyPresentation.js'
import { PhaseChart1822 } from './phaseChart.js'
import { PhaseColors1822, TrainColors1822 } from './trainPresentation.js'

const money = moneyFormat(TitleRules1822.currencySymbol)
const place = (locationId: string) => Map1822.location(locationId).name ?? locationId

/** Whether the major company has joined its destination (§5.11). */
function destinationReached(state: State1822, companyId: string): boolean {
    const major = major1822(companyId)
    if (!major) return false
    if (companyId === LnwrId) return !!state.lnwrConnected
    return state.stations.some(
        (station) =>
            station.status === 'placed' &&
            station.companyId === companyId &&
            station.position.locationId === major.destination.locationId &&
            station.position.nodeId === major.destination.nodeId
    )
}

function discountFacts(state: State1822, companyId: string): TitleFact[] {
    return [
        ...state.discountTokens
            .filter((entry) => entry.companyId === companyId)
            .map((entry) => ({
                label: entry.kind === 'terrain' ? 'Terrain token' : 'Estuary tokens',
                value: String(entry.count)
            })),
        ...(state.hillDiscountCompanyId === companyId
            ? [{ label: 'Hill discount', value: money(20) }]
            : [])
    ]
}

export const Presentation1822: TitlePresentation<State1822> = {
    money,
    phaseChart: PhaseChart1822,
    trainColors: TrainColors1822,
    phaseColors: PhaseColors1822,
    marketPoolId: MarketPoolId1822,
    poolName: (poolId) => (poolId === MarketPoolId1822 ? 'Bank pool' : 'Treasury'),
    companyNames: CompanyNames1822,
    corporateFinance: {
        issue: 'Issue',
        issueNote:
            'Issued shares go to the bank pool, each dropping the value a space; all are paid at the value it comes to rest at.'
    },
    // What a player owes on a loan taken to buy a train (§5.17).
    playerFacts: (state, playerId) => {
        const loan = state.playerLoans.find((entry) => entry.playerId === playerId)
        return loan ? [{ label: 'Loan', value: money(loan.amount) }] : []
    },
    gameFacts: (state) => [
        ...(state.endsAfterNextOperatingRound
            ? [{ label: 'Game end', value: 'After the next operating round' }]
            : []),
        ...(state.doubledCashPlayerId &&
        state.machineState === 'StockRound' &&
        state.cashDeclarationRound === state.stockRound.number
            ? [{ label: 'P9', value: 'Double cash declared' }]
            : [])
    ],
    companyOrigin: (state, companyId) => {
        const major = major1822(companyId)
        if (!major) return undefined
        const name = place(major.destination.locationId)
        return {
            text: destinationReached(state, companyId)
                ? `Reached ${name}: a run from home to there doubles the higher of the two`
                : `Destination: ${name}`,
            connection: { from: major.home.locationId, to: major.destination.locationId }
        }
    },
    companyFacts: (state, companyId) => {
        const company = getCompany(state, companyId)
        if (company.kind === 'minor')
            return [{ label: 'Pays', value: 'Half' }, ...discountFacts(state, companyId)]
        const major = major1822(companyId)
        if (!major) return []
        const exchange = state.exchangeTokens.find((entry) => entry.companyId === companyId)
        return [
            { label: 'Exchange', value: String(exchange?.count ?? 0) },
            ...discountFacts(state, companyId)
        ]
    },
    companyMarks: (state, companyId) =>
        major1822(companyId) && destinationReached(state, companyId)
            ? [
                  {
                      label: 'Dest.',
                      description:
                          'Joined to its destination: a run between its home and destination stations doubles the higher of the two.'
                  }
              ]
            : [],
    // P15 and P20 keep what they have paid on their charter for the company that takes them (Table 3).
    privateStatus: (state, privateCompanyId) => {
        if (!PhaseCreditPrivateIds.includes(privateCompanyId)) return undefined
        if (privateOwner(state, privateCompanyId)?.kind !== 'player') return undefined
        const held = finiteCashOwnedBy(state, { kind: 'company', companyId: privateCompanyId })
        return held ? `Holds ${money(held)}` : undefined
    },
    // P8's standing discount and P10's on rivers (Table 3).
    terrainDiscounts: (state, companyId) => ({
        ...(state.hillDiscountCompanyId === companyId ? { hill: 20, mountain: 20 } : {}),
        ...(privateOwningCompany(state, RiverDiscountPrivateId) === companyId ? { water: 10 } : {})
    }),
    historyMapPlacement: (action) => {
        if (isReachDestination(action) && action.metadata)
            return {
                kind: 'destination',
                companyId: action.companyId,
                locationIds: [action.metadata.locationId]
            }
        if (isPlaceMetropolitanHome(action))
            return { kind: 'home', companyId: action.companyId, locationIds: [LondonLocationId] }
        if (isAcquireMinor(action) && action.metadata?.station)
            return {
                kind: 'exchange token',
                companyId: action.companyId,
                locationIds: [action.metadata.station.locationId]
            }
        if (isAcquirePrivate(action) && action.metadata?.stationId)
            return {
                kind: 'exchange token',
                companyId: action.companyId,
                locationIds: [EnglishChannelLocationId]
            }
        return undefined
    },
    // §4.4, §1.3.1.
    marketZones: [
        {
            color: MarketZoneColors1822.par,
            name: 'Starting values',
            description: 'Major and minor companies start at £60 to £100.'
        },
        {
            color: MarketZoneColors1822.minorPar,
            name: 'Minor start',
            description: 'Only a minor company starts at £50, as every minor does in phase 1.'
        },
        {
            color: MarketZoneColors1822.noLimit,
            name: 'No certificate limit',
            description: 'Certificates of companies valued here do not count against the limit.'
        },
        {
            color: MarketZoneColors1822.end,
            name: 'Game end',
            description:
                'The game ends after the operating round in which a company’s value reaches £700.'
        }
    ]
}
