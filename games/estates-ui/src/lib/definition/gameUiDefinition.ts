import { type GameUiDefinition } from '@tabletop/frontend-components'
import { EstatesDefinition } from '@tabletop/estates'
import { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte.js'
import { EstatesGameColorizer } from './gameColorizer.js'

export const EstatesUiDefinition: GameUiDefinition = Object.assign({}, EstatesDefinition, {
    getTableComponent: async () => {
        return (await import('../components/Table.svelte')).default
    },
    sessionClass: EstatesGameSession,
    colorizer: new EstatesGameColorizer(),
    thumbnailUrl:
        'https://cf.geekdo-images.com/AvC3AzHo8JlcvgKtQ3PDWA__imagepagezoom/img/Vk7f35fyHpdt_Ixw-W0LEQbOb4g=/fit-in/1200x900/filters:no_upscale():strip_icc()/pic4071903.jpg'
})
