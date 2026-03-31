import type {
    GameUIRuntime,
    PlayerColorPalette
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Color } from '@tabletop/common'
import type { FreshFishGameState, HydratedFreshFishGameState } from '@tabletop/fresh-fish'
import { FreshFishRuntime } from '@tabletop/fresh-fish'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { FreshFishColorizer } from './gameColorizer.js'
import Table from '../components/Table.svelte'
import { FreshFishGameSession } from '../stores/FreshFishGameSession.svelte.js'

const freshFishPlayerColorPalette: PlayerColorPalette = {
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
    [Color.Green]: {
        fill: '#016e0a',
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

export const FreshFishUiRuntime: GameUIRuntime<FreshFishGameState, HydratedFreshFishGameState> = {
    ...FreshFishRuntime,
    gameUI: {
        component: Table,
        load: async () => Table,
        mount: mountDynamicComponent
    },
    sessionClass: FreshFishGameSession,
    colorizer: new FreshFishColorizer(),
    playerColorPalette: freshFishPlayerColorPalette
}
