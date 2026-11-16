import { Info1856 } from '@tabletop/1856'
import type { HydratedState1856, State1856 } from '@tabletop/1856'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import thumbnailUrl from './images/cover.webp'

export const UiDefinition: GameUiDefinition<State1856, HydratedState1856> = {
    info: { ...Info1856, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
