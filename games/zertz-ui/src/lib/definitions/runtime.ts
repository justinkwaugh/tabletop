import type {
    GameUIRuntime,
    PlayerColorPalette
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Color } from '@tabletop/common'
import type { HydratedZertzGameState, ZertzGameState } from '@tabletop/zertz'
import { ZertzRuntime } from '@tabletop/zertz'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { ZertzGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { ZertzGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

const zertzPlayerColorPalette: PlayerColorPalette = {
    [Color.Blue]: { fill: '#3f8fd0', text: '#ffffff', contrast: '#ffffff' },
    [Color.Red]: { fill: '#e2513f', text: '#ffffff', contrast: '#ffffff' },
    [Color.Orange]: { fill: '#f97316', text: '#ffffff', contrast: '#ffffff' },
    [Color.Yellow]: { fill: '#f3c244', text: '#1b1b1b', contrast: '#1b1b1b' },
    [Color.Green]: { fill: '#3fa96a', text: '#ffffff', contrast: '#ffffff' },
    [Color.Purple]: { fill: '#8a55a8', text: '#ffffff', contrast: '#ffffff' },
    [Color.Pink]: { fill: '#e2589f', text: '#ffffff', contrast: '#ffffff' },
    [Color.Brown]: { fill: '#9a5a2e', text: '#ffffff', contrast: '#ffffff' },
    [Color.Gray]: { fill: '#9aa3a6', text: '#111111', contrast: '#111111' },
    [Color.Black]: { fill: '#3d3d3d', text: '#ffffff', contrast: '#ffffff' },
    [Color.White]: { fill: '#f1ece0', text: '#182529', contrast: '#182529' }
}

export const ZertzUiRuntime: GameUIRuntime<ZertzGameState, HydratedZertzGameState> = {
    ...ZertzRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: ZertzGameSession,
    colorizer: new ZertzGameColorizer(),
    playerColorPalette: zertzPlayerColorPalette
}
