import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { DickeKartoffelnInfo } from '@tabletop/dicke-kartoffeln'
import type {
    DickeKartoffelnProjectedState,
    HydratedDickeKartoffelnGameState
} from '@tabletop/dicke-kartoffeln'
import coverImg from '$lib/images/cover.webp'

export const UiDefinition: GameUiDefinition<
    DickeKartoffelnProjectedState,
    HydratedDickeKartoffelnGameState
> = {
    info: {
        ...DickeKartoffelnInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).DickeKartoffelnUiRuntime
    }
}
