import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { UrbinoInfo } from '@tabletop/urbino'
import type { UrbinoGameState, HydratedUrbinoGameState } from '@tabletop/urbino'
import coverImg from '$lib/images/urbino-cover.png'

export const UiDefinition: GameUiDefinition<UrbinoGameState, HydratedUrbinoGameState> = {
    info: {
        ...UrbinoInfo,
        thumbnailUrl: coverImg,
        clientCapabilities: gameClientCapabilities()
    },
    runtime: async () => {
        return (await import('./runtime.js')).UrbinoUiRuntime
    }
}
