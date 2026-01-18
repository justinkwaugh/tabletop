import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { EstatesInfo } from '@tabletop/estates'
import type { EstatesGameState, HydratedEstatesGameState } from '@tabletop/estates'

export const UiDefinition: GameUiDefinition<EstatesGameState, HydratedEstatesGameState> = {
    info: {
        ...EstatesInfo,
        thumbnailUrl:
            'https://cf.geekdo-images.com/AvC3AzHo8JlcvgKtQ3PDWA__imagepagezoom/img/Vk7f35fyHpdt_Ixw-W0LEQbOb4g=/fit-in/1200x900/filters:no_upscale():strip_icc()/pic4071903.jpg'
    },
    runtime: async () => {
        return (await import('./definition/gameUiRuntime.js')).EstatesUiRuntime
    }
}
