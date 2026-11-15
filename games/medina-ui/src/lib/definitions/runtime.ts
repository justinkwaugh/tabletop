import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import {
    MedinaRuntime,
    type HydratedMedinaGameState,
    type MedinaProjectedState
} from '@tabletop/medina'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { MedinaColorizer } from './colorizer.js'
import { MedinaPalette } from './palette.js'
import GameTable from '../components/GameTable.svelte'
import { MedinaGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const MedinaUiRuntime: GameUIRuntime<MedinaProjectedState, HydratedMedinaGameState> = {
    ...MedinaRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: MedinaGameSession,
    colorizer: new MedinaColorizer(),
    playerColorPalette: MedinaPalette
}
