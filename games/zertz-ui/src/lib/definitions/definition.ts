import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { ZertzInfo } from '@tabletop/zertz'
import type { ZertzGameState, HydratedZertzGameState } from '@tabletop/zertz'
import coverImg from '$lib/images/zertz-cover.png'

export const UiDefinition: GameUiDefinition<ZertzGameState, HydratedZertzGameState> = {
    info: {
        ...ZertzInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).ZertzUiRuntime
    }
}
