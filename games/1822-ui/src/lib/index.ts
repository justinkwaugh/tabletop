import { Info1822 } from '@tabletop/1822'
import type { HydratedState1822, State1822 } from '@tabletop/1822'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import thumbnailUrl from './images/cover.webp'

export const UiDefinition: GameUiDefinition<State1822, HydratedState1822> = {
    info: { ...Info1822, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
