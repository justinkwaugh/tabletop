import { InfoMex } from '@tabletop/18mex'
import type { HydratedStateMex, StateMex } from '@tabletop/18mex'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import thumbnailUrl from './images/cover.webp'

export const UiDefinition: GameUiDefinition<StateMex, HydratedStateMex> = {
    info: { ...InfoMex, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
