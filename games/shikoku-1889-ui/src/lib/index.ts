import thumbnailUrl from './images/cover.webp'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { HydratedShikoku1889State, Shikoku1889State } from '@tabletop/shikoku-1889'
import { Shikoku1889Info } from '@tabletop/shikoku-1889'

export const UiDefinition: GameUiDefinition<Shikoku1889State, HydratedShikoku1889State> = {
    info: { ...Shikoku1889Info, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
