import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { BusInfo } from '@tabletop/bus'
import type { BusGameState, HydratedBusGameState } from '@tabletop/bus'
import coverImg from '$lib/images/cover.jpg'

export const UiDefinition: GameUiDefinition<BusGameState, HydratedBusGameState> = {
    info: {
        ...BusInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).BusUiRuntime
    }
}
