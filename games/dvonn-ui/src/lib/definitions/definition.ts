import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { DvonnInfo } from '@tabletop/dvonn'
import type { DvonnGameState, HydratedDvonnGameState } from '@tabletop/dvonn'
import coverImg from '$lib/images/dvonn-cover.png'

export const UiDefinition: GameUiDefinition<DvonnGameState, HydratedDvonnGameState> = {
    info: {
        ...DvonnInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).DvonnUiRuntime
    }
}
