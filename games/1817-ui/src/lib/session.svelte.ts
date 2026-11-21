import type { EighteenSeventeenState, HydratedEighteenSeventeenState } from '@tabletop/1817'
import {
    EighteenSeventeenAcquisitionRounds,
    EighteenSeventeenBuyBacks,
    EighteenSeventeenCompanyExcess,
    EighteenSeventeenCompanyMarket,
    EighteenSeventeenConversionRounds,
    EighteenSeventeenLoanRules,
    EighteenSeventeenShortSelling,
    EighteenSeventeenStations,
    EighteenSeventeenTitleRules
} from '@tabletop/1817'
import { assert } from '@tabletop/common'
import { SizedCompanySession, type SessionOptions } from '@tabletop/18xx-ui'
import { EighteenSeventeenMapView } from './mapView.js'
import { createRouteWorker } from './routeWorker.js'
import { EighteenSeventeenPresentation } from './presentation.js'

export class EighteenSeventeenSession extends SizedCompanySession<
    typeof EighteenSeventeenState,
    HydratedEighteenSeventeenState
> {
    constructor(
        options: SessionOptions<typeof EighteenSeventeenState, HydratedEighteenSeventeenState>
    ) {
        super(options, {
            rules: EighteenSeventeenTitleRules,
            mapView: EighteenSeventeenMapView,
            presentation: EighteenSeventeenPresentation,
            mechanisms: {
                market: EighteenSeventeenCompanyMarket,
                stations: EighteenSeventeenStations,
                loanRules: EighteenSeventeenLoanRules,
                conversionRounds: EighteenSeventeenConversionRounds,
                acquisitionRounds: EighteenSeventeenAcquisitionRounds,
                excess: EighteenSeventeenCompanyExcess,
                shortSelling: EighteenSeventeenShortSelling,
                buyBacks: EighteenSeventeenBuyBacks
            },
            createRouteWorker
        })
    }
}

export function requireEighteenSeventeenSession(session: unknown): EighteenSeventeenSession {
    assert(session instanceof EighteenSeventeenSession, 'Expected a 1817 session')
    return session
}
