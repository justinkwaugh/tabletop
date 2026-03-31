import type {
    GameUIRuntime,
    PlayerColorPalette
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Color } from '@tabletop/common'
import type { HydratedSolGameState, SolGameState } from '@tabletop/sol'
import { SolRuntime } from '@tabletop/sol'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { SolGameColorizer } from './gameColorizer.js'
import Table from '../components/Table.svelte'
import { SolGameSession } from '$lib/model/SolGameSession.svelte.js'

const solPlayerColorPalette: PlayerColorPalette = {
    [Color.Blue]: {
        fill: '#539ad1',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Red]: {
        fill: '#e55649',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Yellow]: {
        fill: '#f3c244',
        text: '#000000',
        contrast: '#000000'
    },
    [Color.Green]: {
        fill: '#63b878',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Purple]: {
        fill: '#804796',
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

export const SolUiRuntime: GameUIRuntime<SolGameState, HydratedSolGameState> = {
    ...SolRuntime,
    gameUI: {
        component: Table,
        load: async () => Table,
        mount: mountDynamicComponent
    },
    sessionClass: SolGameSession,
    colorizer: new SolGameColorizer(),
    playerColorPalette: solPlayerColorPalette
}
