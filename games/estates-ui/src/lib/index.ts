import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { EstatesInfo } from '@tabletop/estates'
import type { EstatesProjectedState, HydratedEstatesGameState } from '@tabletop/estates'
import coverImg from '$lib/images/estates-cover.jpg'

export const UiDefinition: GameUiDefinition<EstatesProjectedState, HydratedEstatesGameState> = {
    info: {
        ...EstatesInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./definition/gameUiRuntime.js')).EstatesUiRuntime
    }
}
