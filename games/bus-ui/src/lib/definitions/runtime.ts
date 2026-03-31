import type {
    GameUIRuntime,
    PlayerColorPalette
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Color } from '@tabletop/common'
import type { HydratedBusGameState, BusGameState } from '@tabletop/bus'
import { BusRuntime } from '@tabletop/bus'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { BusGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { BusGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

const busPlayerColorPalette: PlayerColorPalette = {
    [Color.Blue]: {
        fill: '#0c66b4',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Red]: {
        fill: '#ef2519',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Yellow]: {
        fill: '#fba01c',
        text: '#000000',
        contrast: '#000000'
    },
    [Color.Green]: {
        fill: '#097858',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Purple]: {
        fill: '#6e385c',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Gray]: {
        fill: '#aaaaaa',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Black]: {
        fill: '#444444',
        text: '#ffffff',
        contrast: '#ffffff'
    }
}

export const BusUiRuntime: GameUIRuntime<BusGameState, HydratedBusGameState> = {
    ...BusRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: BusGameSession,
    colorizer: new BusGameColorizer(),
    playerColorPalette: busPlayerColorPalette
}
