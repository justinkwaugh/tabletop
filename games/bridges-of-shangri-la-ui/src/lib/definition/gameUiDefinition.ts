import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { BridgesInfo } from '@tabletop/bridges-of-shangri-la'
import type { BridgesGameState, HydratedBridgesGameState } from '@tabletop/bridges-of-shangri-la'
import coverImg from '$lib/images/bridges-cover.jpg'

export const UiDefinition: GameUiDefinition<BridgesGameState, HydratedBridgesGameState> = {
    info: {
        ...BridgesInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./gameUiRuntime.js')).BridgesUiRuntime
    }
}
