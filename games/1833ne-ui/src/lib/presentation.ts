import { assertExists } from '@tabletop/common'
import {
    FerryBonus,
    MarketPoolId,
    ferryDefinition,
    ferryValue,
    FirstRoundReservedHexes,
    MarketZones1833NE,
    Phases1833NE,
    type State1833NE,
    TitleRules1833NE
} from '@tabletop/1833ne'
import {
    moneyFormat,
    type CompanyMark,
    type MapMarkerArt,
    type TitlePresentation
} from '@tabletop/18xx-ui'
import { FerryArt, LuxuryFerryArt } from './ferryArt.js'
import { CompanyNames1833NE } from './companyPresentation.js'
import { PhaseChart1833NE } from './phaseChart.js'
import { PhaseColors1833NE, TrainColors1833NE } from './trainPresentation.js'

const Money = moneyFormat(TitleRules1833NE.currencySymbol)

export const Presentation1833NE: TitlePresentation<State1833NE> = {
    money: Money,
    companyNames: CompanyNames1833NE,
    marketPoolId: MarketPoolId,
    trainColors: TrainColors1833NE,
    phaseColors: PhaseColors1833NE,
    phaseChart: PhaseChart1833NE,
    markerArtFor: playedMarkerArt,
    companyMarks: ferryMarks,
    // Phase III flips the privates corporations hold: no more income, abilities kept (§9).
    privateStatus: (state) =>
        Phases1833NE.isAtLeast(state.phaseId, 'III') ? 'Flipped' : undefined,
    privatePurchaseHeading: 'Available privates',
    privateTilePrompts: { P3: 'Lay free tiles in St. Jean (C4) and C6' },
    marketCell: { width: 36, height: 96 },
    marketZones: [
        {
            color: MarketZones1833NE.launch,
            name: 'Launch',
            banner: { label: 'Initial prices', shape: 'span' },
            description: 'A price a corporation may be launched at.'
        },
        {
            color: MarketZones1833NE.tripleJump,
            name: 'Triple jump',
            banner: { label: 'Triple jump', shape: 'arrow' },
            description:
                'A payout of at least three times the share price moves the price three spaces right.'
        }
    ]
}

type MarkerArt = Record<string, Record<string, MapMarkerArt>>

// The bonus marker's sides: black as printed for New, softened for Last.
const NewBonusFill = '#231f20'
const LastBonusFill = '#4f4a45'

/**
 * The board as play leaves it: the first-round building notes lapse once that round is done,
 * the ferries leave in phase IV, the New/Last bonus marker sits by its ferry, and the Luxury
 * Ferry Service's ferry shows it.
 */
function playedMarkerArt(state: State1833NE): MarkerArt {
    const art: MarkerArt = {}
    const mark = (locationId: string, markerId: string, entry: MapMarkerArt) => {
        art[locationId] = { ...art[locationId], [markerId]: entry }
    }
    const set = state.operatingSet
    if (set && (set.number > 1 || set.roundNumber > 1 || set.completed))
        for (const locationId of Object.keys(FirstRoundReservedHexes))
            mark(locationId, 'first-round', { hidden: true })
    if (Phases1833NE.isAtLeast(state.phaseId, 'IV')) {
        for (const locationId of Object.keys(FerryArt)) mark(locationId, 'ferry', { hidden: true })
        return art
    }
    const bonus = state.ferryBonus
    for (const locationId of Object.keys(FerryArt)) {
        const luxury = state.ferries.some(
            (ferry) => ferry.locationId === locationId && ferry.luxury
        )
        if (!luxury && bonus?.locationId !== locationId) continue
        mark(locationId, 'ferry', {
            token: {
                imageUrl: (luxury ? LuxuryFerryArt : FerryArt)[locationId],
                place: 'corner',
                ...(bonus?.locationId === locationId
                    ? {
                          tab:
                              bonus.side === 'new'
                                  ? {
                                        label: `+${FerryBonus.new}`,
                                        caption: 'NEW',
                                        fill: NewBonusFill
                                    }
                                  : {
                                        label: `+${FerryBonus.last}`,
                                        caption: 'LAST',
                                        fill: LastBonusFill
                                    }
                      }
                    : {})
            }
        })
    }
    return art
}

/** The ferries a corporation owns, as their markers sit on its mat, with the bonus beside one. */
function ferryMarks(state: State1833NE, companyId: string): CompanyMark[] {
    if (Phases1833NE.isAtLeast(state.phaseId, 'IV')) return []
    return state.ferries
        .filter((ferry) => ferry.companyId === companyId)
        .flatMap((ferry): CompanyMark[] => {
            const definition = ferryDefinition(ferry.locationId)
            assertExists(definition, `Unknown ferry ${ferry.locationId}`)
            const value = ferryValue(state, companyId, ferry.locationId)
            const bonus =
                state.ferryBonus?.locationId === ferry.locationId
                    ? state.ferryBonus.side
                    : undefined
            const side = bonus === 'new' ? 'New' : 'Last'
            return [
                {
                    label: definition.name,
                    imageUrl: (ferry.luxury ? LuxuryFerryArt : FerryArt)[ferry.locationId],
                    description: `${definition.name} ferry: ${Money(value)} on its routes${ferry.luxury ? ', doubled by the Luxury Ferry Service' : ''}`
                },
                ...(bonus
                    ? [
                          {
                              label: `+${FerryBonus[bonus]} ${side}`,
                              description: `The ${side} ferry bonus: +${Money(FerryBonus[bonus])} on the ${definition.name} ferry`
                          }
                      ]
                    : [])
            ]
        })
}
