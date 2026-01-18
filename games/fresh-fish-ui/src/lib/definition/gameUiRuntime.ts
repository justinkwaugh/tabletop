import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { FreshFishGameState, HydratedFreshFishGameState } from '@tabletop/fresh-fish'
import { FreshFishRuntime } from '@tabletop/fresh-fish'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { FreshFishColorizer } from './gameColorizer.js'
import Table from '../components/Table.svelte'
import { FreshFishGameSession } from '../stores/FreshFishGameSession.svelte.js'

export const FreshFishUiRuntime: GameUIRuntime<FreshFishGameState, HydratedFreshFishGameState> = {
    ...FreshFishRuntime,
    gameUI: {
        component: Table,
        load: async () => Table,
        mount: mountDynamicComponent
    },
    sessionClass: FreshFishGameSession,
    colorizer: new FreshFishColorizer()
}
