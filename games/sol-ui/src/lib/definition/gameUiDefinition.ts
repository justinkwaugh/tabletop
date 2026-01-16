import { mountDynamicComponent, type GameUiDefinition } from '@tabletop/frontend-components'
import { Definition, HydratedSolGameState, SolGameState } from '@tabletop/sol'
import { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { SolGameColorizer } from './gameColorizer.js'
import Table from '../components/Table.svelte'
import coverImg from '$lib/images/sol-cover.jpg'

export const UiDefinition: GameUiDefinition<SolGameState, HydratedSolGameState> = {
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
            sessionClass: SolGameSession,
            colorizer: new SolGameColorizer()
        }
    }
}
