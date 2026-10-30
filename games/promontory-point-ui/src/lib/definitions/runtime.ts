import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import type {
    HydratedPromontoryPointGameState,
    PromontoryPointProjectedState
} from '@tabletop/promontory-point'
import { PromontoryPointRuntime } from '@tabletop/promontory-point'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { PromontoryPointGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { PromontoryPointGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const PromontoryPointUiRuntime: GameUIRuntime<
    PromontoryPointProjectedState,
    HydratedPromontoryPointGameState
> = {
    ...PromontoryPointRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: PromontoryPointGameSession,
    colorizer: new PromontoryPointGameColorizer()
}
