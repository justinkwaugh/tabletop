import { Info1860 } from '@tabletop/1860'
import type { HydratedState1860, State1860 } from '@tabletop/1860'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import thumbnailUrl from './images/cover.webp'

export const UiDefinition: GameUiDefinition<State1860, HydratedState1860> = {
    info: { ...Info1860, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
