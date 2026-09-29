import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import {
    MagnaGreciaRuntime,
    type HydratedMagnaGreciaGameState,
    type MagnaGreciaGameState
} from '@tabletop/magna-grecia'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { MagnaGreciaColorizer } from './colorizer.js'
import { MagnaGreciaPalette } from './palette.js'
import GameTable from '../components/GameTable.svelte'
import { MagnaGreciaGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const MagnaGreciaUiRuntime: GameUIRuntime<
    MagnaGreciaGameState,
    HydratedMagnaGreciaGameState
> = {
    ...MagnaGreciaRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: MagnaGreciaGameSession,
    colorizer: new MagnaGreciaColorizer(),
    playerColorPalette: MagnaGreciaPalette
}
