import { Info1849 } from '@tabletop/1849'
import type { HydratedState1849, State1849 } from '@tabletop/1849'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import thumbnailUrl from './images/cover.webp'

export const UiDefinition: GameUiDefinition<State1849, HydratedState1849> = {
    info: { ...Info1849, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
