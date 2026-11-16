import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { RideTheRailsInfo } from '@tabletop/ride-the-rails'
import type { HydratedRideTheRailsGameState, RideTheRailsGameState } from '@tabletop/ride-the-rails'
import coverImg from '$lib/images/cover.webp'

export const UiDefinition: GameUiDefinition<RideTheRailsGameState, HydratedRideTheRailsGameState> =
    {
        info: {
            ...RideTheRailsInfo,
            thumbnailUrl: coverImg,
            clientCapabilities: gameClientCapabilities()
        },
        runtime: async () => {
            return (await import('./runtime.js')).RideTheRailsUiRuntime
        }
    }
