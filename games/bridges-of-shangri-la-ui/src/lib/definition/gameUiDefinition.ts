import { type GameUiDefinition } from '@tabletop/frontend-components'
import { BridgesDefinition } from '@tabletop/bridges-of-shangri-la'
import { BridgesGameSession } from '../model/BridgesGameSession.svelte.js'
import { BridgesGameColorizer } from './gameColorizer.js'

export const BridgesUiDefinition: GameUiDefinition = Object.assign({}, BridgesDefinition, {
    getTableComponent: async () => {
        return (await import('../components/Table.svelte')).default
    },
    sessionClass: BridgesGameSession,
    colorizer: new BridgesGameColorizer(),
    thumbnailUrl:
        'https://cf.geekdo-images.com/3Pq36HH-IdFQdMb3OHOVdA__itemrep/img/qHKBb4oW3LIg6E0uZRaw8qz8LxQ=/fit-in/246x300/filters:strip_icc()/pic265554.jpg'
})
