import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { ContainerInfo } from '@tabletop/container'
import type { ContainerGameState, HydratedContainerGameState } from '@tabletop/container'
import coverImg from '$lib/images/cover.jpg'

export const UiDefinition: GameUiDefinition<ContainerGameState, HydratedContainerGameState> = {
    info: {
        ...ContainerInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).ContainerUiRuntime
    }
}
