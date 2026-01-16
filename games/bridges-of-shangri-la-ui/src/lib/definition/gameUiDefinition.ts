import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { DynamicComponentMountFunction } from '@tabletop/frontend-components/utils/dynamicComponent'
import { Definition } from '@tabletop/bridges-of-shangri-la'
import type { BridgesGameState, HydratedBridgesGameState } from '@tabletop/bridges-of-shangri-la'
import { BridgesGameColorizer } from './gameColorizer.js'
import coverImg from '$lib/images/bridges-cover.jpg'

let mountDynamicComponent: DynamicComponentMountFunction | undefined

export const UiDefinition: GameUiDefinition<BridgesGameState, HydratedBridgesGameState> =
    Object.assign({}, Definition, {
        gameUI: {
            load: async () => {
                const [{ default: Table }, dynamicComponent] = await Promise.all([
                    import('../components/Table.svelte'),
                    import('@tabletop/frontend-components/utils/dynamicComponent')
                ])
                mountDynamicComponent = dynamicComponent.mountDynamicComponent
                return Table
            },
            mount: (target, config) => {
                if (!mountDynamicComponent) {
                    throw new Error('Game UI mount called before load.')
                }
                return mountDynamicComponent(target, config)
            }
        },
        sessionClass: async () => {
            return (await import('../model/BridgesGameSession.svelte.js')).BridgesGameSession
        },
        colorizer: new BridgesGameColorizer(),
        thumbnailUrl: coverImg
    })
