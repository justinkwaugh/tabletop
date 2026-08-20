import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { HydratedLowenherzGameState, LowenherzGameState } from '@tabletop/lowenherz'
import { LowenherzRuntime } from '@tabletop/lowenherz'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { LowenherzGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { LowenherzGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const LowenherzUiRuntime: GameUIRuntime<LowenherzGameState, HydratedLowenherzGameState> = {
    ...LowenherzRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: LowenherzGameSession,
    colorizer: new LowenherzGameColorizer()
}
