import { mountDynamicComponent, type GameUiDefinition } from '@tabletop/frontend-components'
import { Definition, FreshFishGameState, HydratedFreshFishGameState } from '@tabletop/fresh-fish'
import { FreshFishGameSession } from '../stores/FreshFishGameSession.svelte'
import { FreshFishColorizer } from './gameColorizer.js'
import coverImg from '$lib/images/fresh-fish-cover.jpg'
import Table from '../components/Table.svelte'

export const UiDefinition: GameUiDefinition<FreshFishGameState, HydratedFreshFishGameState> = {
    info: {
        ...Definition.info,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return {
            ...Definition.runtime,
            gameUI: {
                component: Table,
                load: async () => Table,
                mount: mountDynamicComponent
            },
            sessionClass: FreshFishGameSession,
            colorizer: new FreshFishColorizer()
        }
    }
}
