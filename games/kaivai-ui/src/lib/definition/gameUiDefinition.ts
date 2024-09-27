import { type GameUiDefinition } from '@tabletop/frontend-components'
import { KaivaiDefinition } from '@tabletop/kaivai'
import { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte.js'
import { KaivaiGameColorizer } from './gameColorizer.js'
import coverImg from '$lib/images/kaivai-cover.jpg'

export const KaivaiUiDefinition: GameUiDefinition = Object.assign({}, KaivaiDefinition, {
    getTableComponent: async () => {
        return (await import('../components/Table.svelte')).default
    },
    sessionClass: KaivaiGameSession,
    colorizer: new KaivaiGameColorizer(),
    thumbnailUrl: coverImg
})
