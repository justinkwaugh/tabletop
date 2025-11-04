import { type GameUiDefinition } from '@tabletop/frontend-components'
import { Definition } from '@tabletop/sol'
import { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { SolGameColorizer } from './gameColorizer.js'

export const UiDefinition: GameUiDefinition = Object.assign({}, Definition, {
    getTableComponent: async () => {
        return (await import('../components/Table.svelte')).default
    },
    sessionClass: SolGameSession,
    colorizer: new SolGameColorizer(),
    thumbnailUrl:
        'https://cf.geekdo-images.com/CM-EwyfkFVYK67SOqEsDdA__imagepage/img/Vp3c22Z-Yz5mbFdislTZwsK8f-Q=/fit-in/900x600/filters:no_upscale():strip_icc()/pic2656553.png'
})
