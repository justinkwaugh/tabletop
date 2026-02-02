import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { HydratedContainerGameState, ContainerGameState } from '@tabletop/container'
import { ContainerRuntime } from '@tabletop/container'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { ContainerGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { ContainerGameSession } from '$lib/model/session.svelte.js'

export const ContainerUiRuntime: GameUIRuntime<ContainerGameState, HydratedContainerGameState> = {
    ...ContainerRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: ContainerGameSession,
    colorizer: new ContainerGameColorizer()
}
