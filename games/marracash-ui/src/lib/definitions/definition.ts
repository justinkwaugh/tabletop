import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { MarracashInfo } from '@tabletop/marracash'
import type { MarracashGameState, HydratedMarracashGameState } from '@tabletop/marracash'
import coverImg from '$lib/images/cover.jpg'

export const UiDefinition: GameUiDefinition<MarracashGameState, HydratedMarracashGameState> = {
    info: {
        ...MarracashInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).MarracashUiRuntime
    }
}
