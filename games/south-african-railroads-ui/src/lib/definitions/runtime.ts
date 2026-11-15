import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import {
    SarRuntime,
    type HydratedSarGameState,
    type SarGameState
} from '@tabletop/south-african-railroads'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { SarColorizer } from './colorizer.js'
import { SarPalette } from './palette.js'
import GameTable from '../components/GameTable.svelte'
import { SarGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const SarUiRuntime: GameUIRuntime<SarGameState, HydratedSarGameState> = {
    ...SarRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: SarGameSession,
    colorizer: new SarColorizer(),
    playerColorPalette: SarPalette
}
