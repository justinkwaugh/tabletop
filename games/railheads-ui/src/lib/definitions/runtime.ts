import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import {
    RailheadsRuntime,
    type HydratedRailheadsGameState,
    type RailheadsProjectedState
} from '@tabletop/railheads'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { RailheadsColorizer } from './colorizer.js'
import { RailheadsPalette } from './palette.js'
import GameTable from '../components/GameTable.svelte'
import { RailheadsGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const RailheadsUiRuntime: GameUIRuntime<
    RailheadsProjectedState,
    HydratedRailheadsGameState
> = {
    ...RailheadsRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: RailheadsGameSession,
    colorizer: new RailheadsColorizer(),
    playerColorPalette: RailheadsPalette
}
