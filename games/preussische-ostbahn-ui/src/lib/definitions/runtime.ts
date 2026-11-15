import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import {
    OstbahnRuntime,
    type HydratedOstbahnGameState,
    type OstbahnGameState
} from '@tabletop/preussische-ostbahn'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { OstbahnColorizer } from './colorizer.js'
import { OstbahnPalette } from './palette.js'
import GameTable from '../components/GameTable.svelte'
import { OstbahnGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const OstbahnUiRuntime: GameUIRuntime<OstbahnGameState, HydratedOstbahnGameState> = {
    ...OstbahnRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: OstbahnGameSession,
    colorizer: new OstbahnColorizer(),
    playerColorPalette: OstbahnPalette
}
