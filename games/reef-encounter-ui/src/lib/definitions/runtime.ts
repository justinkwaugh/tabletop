import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import type {
    HydratedReefEncounterGameState,
    ReefEncounterProjectedState
} from '@tabletop/reef-encounter'
import { ReefEncounterRuntime } from '@tabletop/reef-encounter'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { ReefEncounterGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { ReefEncounterGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const ReefEncounterUiRuntime: GameUIRuntime<
    ReefEncounterProjectedState,
    HydratedReefEncounterGameState
> = {
    ...ReefEncounterRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: ReefEncounterGameSession,
    colorizer: new ReefEncounterGameColorizer()
}
