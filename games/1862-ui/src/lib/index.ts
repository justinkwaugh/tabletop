import { Info1862 } from '@tabletop/1862'
import type { HydratedState1862, State1862 } from '@tabletop/1862'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import thumbnailUrl from './images/cover.webp'

export const UiDefinition: GameUiDefinition<State1862, HydratedState1862> = {
    info: { ...Info1862, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
