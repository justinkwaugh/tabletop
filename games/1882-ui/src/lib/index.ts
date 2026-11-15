import { Info1882 } from '@tabletop/1882'
import type { HydratedState1882, State1882 } from '@tabletop/1882'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import thumbnailUrl from './images/cover.webp'

export const UiDefinition: GameUiDefinition<State1882, HydratedState1882> = {
    info: { ...Info1882, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
