import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { KoenigrufenInfo } from '@tabletop/koenigrufen'
import type { HydratedKoenigrufenGameState, KoenigrufenProjectedState } from '@tabletop/koenigrufen'
import coverImg from '$lib/images/cover.webp'

export const UiDefinition: GameUiDefinition<
    KoenigrufenProjectedState,
    HydratedKoenigrufenGameState
> = {
    info: {
        ...KoenigrufenInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).KoenigrufenUiRuntime
    }
}
