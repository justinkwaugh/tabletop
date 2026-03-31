import type {
    GameUIRuntime,
    PlayerColorPalette
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Color } from '@tabletop/common'
import type { EstatesGameState, HydratedEstatesGameState } from '@tabletop/estates'
import { EstatesRuntime } from '@tabletop/estates'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { EstatesGameColorizer } from './gameColorizer.js'
import Table from '../components/Table.svelte'
import { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte.js'

const estatesPlayerColorPalette: PlayerColorPalette = {
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
        fill: '#888888',
        text: '#ffffff',
        contrast: '#ffffff'
    }
}

export const EstatesUiRuntime: GameUIRuntime<EstatesGameState, HydratedEstatesGameState> = {
    ...EstatesRuntime,
    gameUI: {
        component: Table,
        load: async () => Table,
        mount: mountDynamicComponent
    },
    sessionClass: EstatesGameSession,
    colorizer: new EstatesGameColorizer(),
    playerColorPalette: estatesPlayerColorPalette
}
