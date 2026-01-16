import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Definition } from '@tabletop/bridges-of-shangri-la'
import type { BridgesGameState, HydratedBridgesGameState } from '@tabletop/bridges-of-shangri-la'
import { BridgesGameColorizer } from './gameColorizer.js'
import coverImg from '$lib/images/bridges-cover.jpg'

export const UiDefinition: GameUiDefinition<BridgesGameState, HydratedBridgesGameState> =
    Object.assign({}, Definition, {
        gameUI: {
            load: async () => {
                return (await import('../components/Table.svelte')).default
            },
            mount: mountDynamicComponent
        },
        sessionClass: async () => {
            return (await import('../model/BridgesGameSession.svelte.js')).BridgesGameSession
        },
        colorizer: new BridgesGameColorizer(),
        thumbnailUrl: coverImg
    })
