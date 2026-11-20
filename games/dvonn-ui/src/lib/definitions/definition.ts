import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { DvonnInfo } from '@tabletop/dvonn'
import type { DvonnGameState, HydratedDvonnGameState } from '@tabletop/dvonn'
import coverImg from '$lib/images/dvonn-cover.webp'

export const UiDefinition: GameUiDefinition<DvonnGameState, HydratedDvonnGameState> = {
    info: {
        ...DvonnInfo,
        thumbnailUrl: coverImg,
        clientCapabilities: gameClientCapabilities()
    },
    runtime: async () => {
        return (await import('./runtime.js')).DvonnUiRuntime
    }
}
