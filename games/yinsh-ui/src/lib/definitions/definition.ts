import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { YinshInfo } from '@tabletop/yinsh'
import type { YinshGameState, HydratedYinshGameState } from '@tabletop/yinsh'
import coverImg from '$lib/images/yinsh-cover.png'

export const UiDefinition: GameUiDefinition<YinshGameState, HydratedYinshGameState> = {
    info: {
        ...YinshInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).YinshUiRuntime
    }
}
