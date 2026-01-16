import { mountDynamicComponent, type GameUiDefinition } from '@tabletop/frontend-components'
import { Definition, HydratedKaivaiGameState, KaivaiGameState } from '@tabletop/kaivai'
import { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte.js'
import { KaivaiGameColorizer } from './gameColorizer.js'
import coverImg from '$lib/images/kaivai-cover.jpg'
import Table from '../components/Table.svelte'

export const UiDefinition: GameUiDefinition<KaivaiGameState, HydratedKaivaiGameState> = {
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
            sessionClass: KaivaiGameSession,
            colorizer: new KaivaiGameColorizer()
        }
    }
}
