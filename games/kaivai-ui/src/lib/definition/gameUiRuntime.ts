import type {
    GameUIRuntime,
    PlayerColorPalette
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Color } from '@tabletop/common'
import type { HydratedKaivaiGameState, KaivaiGameState } from '@tabletop/kaivai'
import { KaivaiRuntime } from '@tabletop/kaivai'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { KaivaiGameColorizer } from './gameColorizer.js'
import Table from '../components/GameTable.svelte'
import { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte.js'

const kaivaiPlayerColorPalette: PlayerColorPalette = {
    [Color.Blue]: {
        fill: '#3d467c',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Red]: {
        fill: '#c14239',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Yellow]: {
        fill: '#ffee86',
        text: '#000000',
        contrast: '#000000'
    },
    [Color.Green]: {
        fill: '#759329',
        text: '#ffffff',
        contrast: '#ffffff'
    }
}

export const KaivaiUiRuntime: GameUIRuntime<KaivaiGameState, HydratedKaivaiGameState> = {
    ...KaivaiRuntime,
    gameUI: {
        component: Table,
        load: async () => Table,
        mount: mountDynamicComponent
    },
    sessionClass: KaivaiGameSession,
    colorizer: new KaivaiGameColorizer(),
    playerColorPalette: kaivaiPlayerColorPalette
}
