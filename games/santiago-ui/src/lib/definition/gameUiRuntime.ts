import type {
    GameUIRuntime,
    PlayerColorPalette
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Color } from '@tabletop/common'
import type { SantiagoGameState, HydratedSantiagoGameState } from '@tabletop/santiago'
import { SantiagoRuntime } from '@tabletop/santiago'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { SantiagoColorizer } from './gameColorizer.js'
import Table from '../components/Table.svelte'
import { SantiagoGameSession } from '../stores/SantiagoGameSession.svelte.js'

const santiagoPlayerColorPalette: PlayerColorPalette = {
    [Color.Blue]: { fill: '#0d56ad', text: '#ffffff', contrast: '#ffffff' },
    [Color.Red]: { fill: '#ad0207', text: '#ffffff', contrast: '#ffffff' },
    [Color.Green]: { fill: '#016e0a', text: '#ffffff', contrast: '#ffffff' },
    [Color.Yellow]: { fill: '#fae54b', text: '#000000', contrast: '#000000' },
    [Color.Purple]: { fill: '#9a0ee6', text: '#ffffff', contrast: '#ffffff' }
}

export const SantiagoUiRuntime: GameUIRuntime<SantiagoGameState, HydratedSantiagoGameState> = {
    ...SantiagoRuntime,
    gameUI: {
        component: Table,
        load: async () => Table,
        mount: mountDynamicComponent
    },
    sessionClass: SantiagoGameSession,
    colorizer: new SantiagoColorizer(),
    playerColorPalette: santiagoPlayerColorPalette
}
