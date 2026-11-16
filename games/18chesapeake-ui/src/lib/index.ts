import { InfoChesapeake } from '@tabletop/18chesapeake'
import type { HydratedStateChesapeake, StateChesapeake } from '@tabletop/18chesapeake'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import thumbnailUrl from './images/cover.webp'

export const UiDefinition: GameUiDefinition<StateChesapeake, HydratedStateChesapeake> = {
    info: { ...InfoChesapeake, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
