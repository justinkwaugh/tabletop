import {
    MergerRounds1867,
    TitleRules1867,
    type HydratedState1867,
    type State1867
} from '@tabletop/1867'
import { assert } from '@tabletop/common'
import type { GameSession } from '@tabletop/frontend-components'
import {
    NationalRailwaySession,
    type HistoricalMapState,
    type SessionOptions
} from '@tabletop/18xx-ui'
import { mapState1867 } from './mapState.js'
import { MapView1867 } from './mapView.js'
import { Presentation1867 } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'

export class Session1867 extends NationalRailwaySession<typeof State1867, HydratedState1867> {
    constructor(options: SessionOptions<typeof State1867, HydratedState1867>) {
        super(options, {
            rules: TitleRules1867,
            mapView: MapView1867,
            presentation: Presentation1867,
            mergerRounds: MergerRounds1867,
            createRouteWorker
        })
    }

    protected override projectMapState(state: HydratedState1867): HistoricalMapState {
        return mapState1867(state)
    }
}

export function requireSession1867(
    session: GameSession<State1867, HydratedState1867>
): Session1867 {
    assert(session instanceof Session1867, '1867 requires its title session')
    return session
}
