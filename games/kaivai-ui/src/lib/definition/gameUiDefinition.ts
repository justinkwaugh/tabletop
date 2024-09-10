import { type GameUiDefinition } from '@tabletop/frontend-components'
import { KaivaiDefinition } from '@tabletop/kaivai'
import { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte.js'

export const KaivaiUiDefinition: GameUiDefinition = Object.assign({}, KaivaiDefinition, {
    getTableComponent: async () => {
        return (await import('../components/Table.svelte')).default
    },
    sessionClass: KaivaiGameSession,
    thumbnailUrl:
        'https://cf.geekdo-images.com/9kuCa24rLmMxptabkzui0Q__imagepagezoom/img/E6pBLrKogJh247-SLuFMuestVCQ=/fit-in/1200x900/filters:no_upscale():strip_icc()/pic751269.jpg'
})
