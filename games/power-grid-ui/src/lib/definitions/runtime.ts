import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import {
    PowerGridRuntime,
    type HydratedPowerGridGameState,
    type PowerGridProjectedState
} from '@tabletop/power-grid'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { PowerGridColorizer } from './colorizer.js'
import { PowerGridPalette } from './palette.js'
import GameTable from '../components/GameTable.svelte'
import { PowerGridGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const PowerGridUiRuntime: GameUIRuntime<
    PowerGridProjectedState,
    HydratedPowerGridGameState
> = {
    ...PowerGridRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: PowerGridGameSession,
    colorizer: new PowerGridColorizer(),
    playerColorPalette: PowerGridPalette
}
