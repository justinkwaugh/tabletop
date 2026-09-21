import { Shikoku1889AuctionRules, Shikoku1889TrainFundingRules } from '@tabletop/shikoku-1889'
import { Shikoku1889TransferRules, Shikoku1889PrivatePowerRules } from '@tabletop/shikoku-1889'
import { Shikoku1889PrivateRules } from '@tabletop/shikoku-1889'
import { Shikoku1889EarningsRules } from '@tabletop/shikoku-1889'
import { Shikoku1889RouteRules } from '@tabletop/shikoku-1889'
import { Shikoku1889TrainRules } from '@tabletop/shikoku-1889'
import { Shikoku1889StationRules } from '@tabletop/shikoku-1889'
import { Shikoku1889MapView } from './mapView.js'
import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import {
    Definition,
    Shikoku1889StockRules,
    Shikoku1889CompanyRules,
    Shikoku1889TrackRules
} from '@tabletop/shikoku-1889'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import type { GameState, HydratedGameState } from '@tabletop/common'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<GameState, HydratedGameState> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: createEighteenXXSessionClass(
        Shikoku1889StockRules,
        Shikoku1889CompanyRules,
        Shikoku1889MapView,
        Shikoku1889TrackRules,
        Shikoku1889StationRules,
        Shikoku1889TrainRules,
        Shikoku1889RouteRules,
        Shikoku1889EarningsRules,
        Shikoku1889PrivateRules,
        Shikoku1889TransferRules,
        Shikoku1889PrivatePowerRules,
        Shikoku1889TrainFundingRules,
        Shikoku1889AuctionRules
    ),
    colorizer: new DefaultColorizer()
}
