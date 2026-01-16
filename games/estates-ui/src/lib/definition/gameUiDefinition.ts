import { mountDynamicComponent, type GameUiDefinition } from '@tabletop/frontend-components'
import { Definition, EstatesGameState, HydratedEstatesGameState } from '@tabletop/estates'
import { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte.js'
import { EstatesGameColorizer } from './gameColorizer.js'
import Table from '../components/Table.svelte'

export const UiDefinition: GameUiDefinition<EstatesGameState, HydratedEstatesGameState> = {
    info: {
        ...Definition.info,
        thumbnailUrl:
            'https://cf.geekdo-images.com/AvC3AzHo8JlcvgKtQ3PDWA__imagepagezoom/img/Vk7f35fyHpdt_Ixw-W0LEQbOb4g=/fit-in/1200x900/filters:no_upscale():strip_icc()/pic4071903.jpg'
    },
    runtime: async () => {
        return {
            ...Definition.runtime,
            gameUI: {
                component: Table,
                load: async () => Table,
                mount: mountDynamicComponent
            },
            sessionClass: EstatesGameSession,
            colorizer: new EstatesGameColorizer()
        }
    }
}
