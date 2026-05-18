import type {
    GameUIRuntime,
    PlayerColorPalette
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Color } from '@tabletop/common'
import type { HydratedUrbinoGameState, UrbinoGameState } from '@tabletop/urbino'
import { UrbinoRuntime } from '@tabletop/urbino'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { UrbinoGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { UrbinoGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

const urbinoPlayerColorPalette: PlayerColorPalette = {
    [Color.White]: {
        fill: '#f5f0e8',
        text: '#2c1810',
        contrast: '#2c1810'
    },
    [Color.Brown]: {
        fill: '#6b3a2a',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Red]: { fill: '#ef2519', text: '#ffffff', contrast: '#ffffff' },
    [Color.Orange]: { fill: '#f97316', text: '#ffffff', contrast: '#ffffff' },
    [Color.Yellow]: { fill: '#fba01c', text: '#000000', contrast: '#000000' },
    [Color.Green]: { fill: '#097858', text: '#ffffff', contrast: '#ffffff' },
    [Color.Blue]: { fill: '#0c66b4', text: '#ffffff', contrast: '#ffffff' },
    [Color.Purple]: { fill: '#6e385c', text: '#ffffff', contrast: '#ffffff' },
    [Color.Pink]: { fill: '#ec4899', text: '#ffffff', contrast: '#ffffff' },
    [Color.Gray]: { fill: '#aaaaaa', text: '#ffffff', contrast: '#ffffff' },
    [Color.Black]: { fill: '#444444', text: '#ffffff', contrast: '#ffffff' },
}

export const UrbinoUiRuntime: GameUIRuntime<UrbinoGameState, HydratedUrbinoGameState> = {
    ...UrbinoRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: UrbinoGameSession,
    colorizer: new UrbinoGameColorizer(),
    playerColorPalette: urbinoPlayerColorPalette
}
