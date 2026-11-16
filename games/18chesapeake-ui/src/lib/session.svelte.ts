import {
    TitleRulesChesapeake,
    BoId,
    BopId,
    CvId,
    editionChesapeake,
    offTheRails,
    type HydratedStateChesapeake,
    type StateChesapeake
} from '@tabletop/18chesapeake'
import { assert } from '@tabletop/common'
import type { GameSession } from '@tabletop/frontend-components'
import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import { MapViewChesapeake } from './mapView.js'
import { OffTheRailsMarketZones, PresentationChesapeake } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<typeof StateChesapeake, HydratedStateChesapeake>
> = createEighteenXXSessionClass<typeof StateChesapeake, HydratedStateChesapeake>(
    TitleRulesChesapeake,
    MapViewChesapeake,
    PresentationChesapeake,
    createRouteWorker
)

export class SessionChesapeake extends BaseSession {
    // The B&O private brings a B&O share; Cornelius Vanderbilt the presidency drawn at setup
    // (§3, §7.1).
    override privateCompanyTokens = $derived({
        [BopId]: this.mapView.stations[BoId],
        [CvId]: this.mapView.stations[this.gameState.corneliusCompanyId]
    })
    /** The game's own market, the printed one or Off the Rails's. */
    override get stockMarketChart() {
        return editionChesapeake(this.gameState).market
    }
    override readonly presentation = $derived(
        offTheRails(this.gameState)
            ? { ...PresentationChesapeake, marketZones: OffTheRailsMarketZones }
            : PresentationChesapeake
    )
}

export function requireSessionChesapeake(
    session: GameSession<StateChesapeake, HydratedStateChesapeake>
): SessionChesapeake {
    assert(session instanceof SessionChesapeake, '18Chesapeake requires its title session')
    return session
}
