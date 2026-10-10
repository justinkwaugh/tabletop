import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { NapoleonsTriumphInfo } from '@tabletop/napoleons-triumph'
import type {
    HydratedNapoleonsTriumphGameState,
    NapoleonsTriumphProjectedState
} from '@tabletop/napoleons-triumph'
import coverImg from '$lib/images/cover.jpg'

export const UiDefinition: GameUiDefinition<
    NapoleonsTriumphProjectedState,
    HydratedNapoleonsTriumphGameState
> = {
    info: {
        ...NapoleonsTriumphInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).NapoleonsTriumphUiRuntime
    }
}
