import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import {
    KoggeRuntime,
    type HydratedKoggeGameState,
    type KoggeProjectedState
} from '@tabletop/kogge'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { KoggeColorizer } from './colorizer.js'
import { KoggePalette } from './palette.js'
import GameTable from '../components/GameTable.svelte'
import { KoggeGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const KoggeUiRuntime: GameUIRuntime<KoggeProjectedState, HydratedKoggeGameState> = {
    ...KoggeRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: KoggeGameSession,
    colorizer: new KoggeColorizer(),
    playerColorPalette: KoggePalette
}
