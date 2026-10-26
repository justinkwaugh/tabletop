import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { KaivaiInfo } from '@tabletop/kaivai'
import type { HydratedKaivaiGameState, KaivaiProjectedState } from '@tabletop/kaivai'
import coverImg from '$lib/images/kaivai-cover.jpg'

export const UiDefinition: GameUiDefinition<KaivaiProjectedState, HydratedKaivaiGameState> = {
    info: {
        ...KaivaiInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./definition/gameUiRuntime.js')).KaivaiUiRuntime
    }
}
