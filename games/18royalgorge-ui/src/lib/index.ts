import { InfoRoyalGorge } from '@tabletop/18royalgorge'
import type { HydratedStateRoyalGorge, StateRoyalGorge } from '@tabletop/18royalgorge'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import thumbnailUrl from './images/cover.webp'

export const UiDefinition: GameUiDefinition<StateRoyalGorge, HydratedStateRoyalGorge> = {
    info: { ...InfoRoyalGorge, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
