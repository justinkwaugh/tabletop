import { type GameUiDefinition } from '@tabletop/frontend-components'
import { Definition, HydratedKaivaiGameState, KaivaiGameState } from '@tabletop/kaivai'
import { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte.js'
import { KaivaiGameColorizer } from './gameColorizer.js'
import coverImg from '$lib/images/kaivai-cover.jpg'

export const UiDefinition: GameUiDefinition<KaivaiGameState, HydratedKaivaiGameState> =
    Object.assign({}, Definition, {
        getTableComponent: async () => {
            return (await import('../components/Table.svelte')).default
        },
        sessionClass: KaivaiGameSession,
        colorizer: new KaivaiGameColorizer(),
        thumbnailUrl: coverImg
    })
