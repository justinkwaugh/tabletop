import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { TzaarInfo } from '@tabletop/tzaar'
import type { TzaarGameState, HydratedTzaarGameState } from '@tabletop/tzaar'
import coverImg from '$lib/images/tzaar-cover.webp'

export const UiDefinition: GameUiDefinition<TzaarGameState, HydratedTzaarGameState> = {
    info: {
        ...TzaarInfo,
        thumbnailUrl: coverImg,
        clientCapabilities: gameClientCapabilities()
    },
    runtime: async () => {
        return (await import('./runtime.js')).TzaarUiRuntime
    }
}
