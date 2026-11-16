import type {
    GameUIRuntime,
    PlayerColorPalette
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Color } from '@tabletop/common'
import type { HydratedLyngkGameState, LyngkGameState } from '@tabletop/lyngk'
import { LyngkRuntime } from '@tabletop/lyngk'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { LyngkGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { LyngkGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

const lyngkPlayerColorPalette: PlayerColorPalette = {
    [Color.White]: { fill: '#ece7dc', text: '#1b1c1f', contrast: '#1b1c1f' },
    [Color.Black]: { fill: '#16171a', text: '#f2efe8', contrast: '#f2efe8' },
    [Color.Red]: { fill: '#e2513f', text: '#ffffff', contrast: '#ffffff' },
    [Color.Orange]: { fill: '#f97316', text: '#ffffff', contrast: '#ffffff' },
    [Color.Yellow]: { fill: '#f3c244', text: '#1b1b1b', contrast: '#1b1b1b' },
    [Color.Green]: { fill: '#3fa96a', text: '#ffffff', contrast: '#ffffff' },
    [Color.Blue]: { fill: '#3f8fd0', text: '#ffffff', contrast: '#ffffff' },
    [Color.Purple]: { fill: '#8a55a8', text: '#ffffff', contrast: '#ffffff' },
    [Color.Pink]: { fill: '#e2589f', text: '#ffffff', contrast: '#ffffff' },
    [Color.Brown]: { fill: '#9a5a2e', text: '#ffffff', contrast: '#ffffff' },
    [Color.Gray]: { fill: '#9aa3a6', text: '#111111', contrast: '#111111' }
}

export const LyngkUiRuntime: GameUIRuntime<LyngkGameState, HydratedLyngkGameState> = {
    ...LyngkRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: LyngkGameSession,
    colorizer: new LyngkGameColorizer(),
    playerColorPalette: lyngkPlayerColorPalette
}
