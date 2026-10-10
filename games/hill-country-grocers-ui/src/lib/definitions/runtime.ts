import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import {
    HcgRuntime,
    type HcgGameState,
    type HydratedHcgGameState
} from '@tabletop/hill-country-grocers'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { HcgColorizer } from './colorizer.js'
import { HcgPalette } from './palette.js'
import GameTable from '../components/GameTable.svelte'
import { HcgGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const HcgUiRuntime: GameUIRuntime<HcgGameState, HydratedHcgGameState> = {
    ...HcgRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: HcgGameSession,
    colorizer: new HcgColorizer(),
    playerColorPalette: HcgPalette
}
