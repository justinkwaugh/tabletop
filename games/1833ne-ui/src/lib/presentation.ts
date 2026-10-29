import {
    FirstRoundReservedHexes,
    MarketZones1833NE,
    Phases1833NE,
    type State1833NE
} from '@tabletop/1833ne'
import { moneyFormat, type MapMarkerArt, type TitlePresentation } from '@tabletop/18xx-ui'
import { FerryArt, LuxuryFerryArt } from './ferryArt.js'
import { CompanyNames1833NE } from './companyPresentation.js'
import { PhaseChart1833NE } from './phaseChart.js'
import { PhaseColors1833NE, TrainColors1833NE } from './trainPresentation.js'

export const Presentation1833NE: TitlePresentation<State1833NE> = {
    money: moneyFormat('$'),
    companyNames: CompanyNames1833NE,
    marketPoolId: 'open-market',
    trainColors: TrainColors1833NE,
    phaseColors: PhaseColors1833NE,
    phaseChart: PhaseChart1833NE,
    markerArtFor: playedMarkerArt,
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

/**
 * The board as play leaves it: the first-round building notes lapse once that round is done,
 * the ferries leave in phase IV, and the Luxury Ferry Service's ferry shows it.
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
    if (Phases1833NE.isAtLeast(state.phaseId, 'IV'))
        for (const locationId of Object.keys(FerryArt)) mark(locationId, 'ferry', { hidden: true })
    else
        for (const ferry of state.ferries.filter((owned) => owned.luxury))
            mark(ferry.locationId, 'ferry', {
                token: { imageUrl: LuxuryFerryArt[ferry.locationId], place: 'corner' }
            })
    return art
}
