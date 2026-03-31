import type {
    GameUIRuntime,
    PlayerColorPalette
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Color } from '@tabletop/common'
import type { HydratedContainerGameState, ContainerGameState } from '@tabletop/container'
import { ContainerRuntime } from '@tabletop/container'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { ContainerGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { ContainerGameSession } from '$lib/model/session.svelte.js'

const containerPlayerColorPalette: PlayerColorPalette = {
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

export const ContainerUiRuntime: GameUIRuntime<ContainerGameState, HydratedContainerGameState> = {
    ...ContainerRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: ContainerGameSession,
    colorizer: new ContainerGameColorizer(),
    playerColorPalette: containerPlayerColorPalette
}
