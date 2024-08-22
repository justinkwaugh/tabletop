import { type GameUiDefinition } from '@tabletop/frontend-components'
import { FreshFishDefinition } from '@tabletop/fresh-fish'
import { FreshFishGameSession } from '../stores/FreshFishGameSession.svelte'

export const FreshFishUiDefinition: GameUiDefinition = Object.assign({}, FreshFishDefinition, {
    getTableComponent: async () => {
        return (await import('../components/Table.svelte')).default
    },
    sessionClass: FreshFishGameSession,
    thumbnailUrl:
        'https://cf.geekdo-images.com/d8qNi3yb7lzLc9FJYyP91Q__itemrep/img/qW_Sn2tD1w8pGYZnwtoq6L37uoM=/fit-in/246x300/filters:strip_icc()/pic2220379.jpg'
})
