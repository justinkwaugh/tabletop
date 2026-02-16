import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { HydratedIndonesiaGameState, IndonesiaGameState } from '@tabletop/indonesia'
import { IndonesiaRuntime } from '@tabletop/indonesia'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { IndonesiaGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { IndonesiaGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const IndonesiaUiRuntime: GameUIRuntime<IndonesiaGameState, HydratedIndonesiaGameState> = {
    ...IndonesiaRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: IndonesiaGameSession,
    colorizer: new IndonesiaGameColorizer()
}
