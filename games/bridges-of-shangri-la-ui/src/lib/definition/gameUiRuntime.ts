import type {
    GameUIRuntime,
    PlayerColorPalette
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Color } from '@tabletop/common'
import type { BridgesGameState, HydratedBridgesGameState } from '@tabletop/bridges-of-shangri-la'
import { BridgesRuntime } from '@tabletop/bridges-of-shangri-la'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { BridgesGameColorizer } from './gameColorizer.js'
import Table from '../components/Table.svelte'
import { BridgesGameSession } from '../model/BridgesGameSession.svelte.js'
import '../../app.css'

const bridgesPlayerColorPalette: PlayerColorPalette = {
    [Color.Blue]: {
        fill: '#0d56ad',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Red]: {
        fill: '#ad0207',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Yellow]: {
        fill: '#fae54b',
        text: '#000000',
        contrast: '#000000'
    },
    [Color.Purple]: {
        fill: '#9a0ee6',
        text: '#ffffff',
        contrast: '#ffffff'
    }
}

export const BridgesUiRuntime: GameUIRuntime<BridgesGameState, HydratedBridgesGameState> = {
    ...BridgesRuntime,
    gameUI: {
        component: Table,
        load: async () => Table,
        mount: mountDynamicComponent
    },
    sessionClass: BridgesGameSession,
    colorizer: new BridgesGameColorizer(),
    playerColorPalette: bridgesPlayerColorPalette
}
