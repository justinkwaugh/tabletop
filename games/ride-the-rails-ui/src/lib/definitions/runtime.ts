import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { HydratedRideTheRailsGameState, RideTheRailsGameState } from '@tabletop/ride-the-rails'
import { RideTheRailsRuntime } from '@tabletop/ride-the-rails'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { RideTheRailsGameColorizer } from './colorizer.js'
import { RideTheRailsSeatPalette } from './seatPalette.js'
import GameTable from '../components/GameTable.svelte'
import { RideTheRailsGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const RideTheRailsUiRuntime: GameUIRuntime<
    RideTheRailsGameState,
    HydratedRideTheRailsGameState
> = {
    ...RideTheRailsRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: RideTheRailsGameSession,
    colorizer: new RideTheRailsGameColorizer(),
    playerColorPalette: RideTheRailsSeatPalette
}
