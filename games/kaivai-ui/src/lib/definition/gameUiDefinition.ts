import { type GameUiDefinition } from '@tabletop/frontend-components'
import { KaivaiDefinition } from '@tabletop/kaivai'
import { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte.js'

export const KaivaiUiDefinition: GameUiDefinition = Object.assign({}, KaivaiDefinition, {
    getTableComponent: async () => {
        return (await import('../components/Table.svelte')).default
    },
    sessionClass: KaivaiGameSession,
    thumbnailUrl:
        'https://cf.geekdo-images.com/3Pq36HH-IdFQdMb3OHOVdA__itemrep/img/qHKBb4oW3LIg6E0uZRaw8qz8LxQ=/fit-in/246x300/filters:strip_icc()/pic265554.jpg'
})
