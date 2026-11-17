import {
    MergerRounds1861,
    TitleRules1861,
    type HydratedState1861,
    type State1861
} from '@tabletop/1861'
import { assert } from '@tabletop/common'
import type { GameSession } from '@tabletop/frontend-components'
import {
    NationalRailwaySession,
    type HistoricalMapState,
    type SessionOptions
} from '@tabletop/18xx-ui'
import { mapState1861 } from './mapState.js'
import { MapView1861 } from './mapView.js'
import { Presentation1861 } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'

export class Session1861 extends NationalRailwaySession<typeof State1861, HydratedState1861> {
    constructor(options: SessionOptions<typeof State1861, HydratedState1861>) {
        super(options, {
            rules: TitleRules1861,
            mapView: MapView1861,
            presentation: Presentation1861,
            mergerRounds: MergerRounds1861,
            createRouteWorker
        })
    }

    protected override projectMapState(state: HydratedState1861): HistoricalMapState {
        return mapState1861(state)
    }
}

export function requireSession1861(
    session: GameSession<State1861, HydratedState1861>
): Session1861 {
    assert(session instanceof Session1861, '1861 requires its title session')
    return session
}
