import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import {
    StellarHorizonsRuntime,
    type HydratedStellarHorizonsGameState,
    type StellarHorizonsProjectedState
} from '@tabletop/stellar-horizons-2'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { StellarHorizonsColorizer } from './colorizer.js'
import { StellarHorizonsPalette } from './palette.js'
import GameTable from '../components/GameTable.svelte'
import { StellarHorizonsGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const StellarHorizonsUiRuntime: GameUIRuntime<
    StellarHorizonsProjectedState,
    HydratedStellarHorizonsGameState
> = {
    ...StellarHorizonsRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: StellarHorizonsGameSession,
    colorizer: new StellarHorizonsColorizer(),
    playerColorPalette: StellarHorizonsPalette
}
