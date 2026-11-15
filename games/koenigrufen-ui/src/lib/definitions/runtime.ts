import type {
    GameUIRuntime,
    PlayerColorPalette
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { KoenigrufenRuntime } from '@tabletop/koenigrufen'
import type { HydratedKoenigrufenGameState, KoenigrufenProjectedState } from '@tabletop/koenigrufen'
import GameTable from '../components/GameTable.svelte'
import { KoenigrufenGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

const koenigrufenPlayerColorPalette: PlayerColorPalette = {
    [Color.Red]: { fill: '#b8322a', text: '#ffffff', contrast: '#ffffff' },
    [Color.Blue]: { fill: '#2c5f9e', text: '#ffffff', contrast: '#ffffff' },
    [Color.Green]: { fill: '#c9a227', text: '#000000', contrast: '#000000' },
    [Color.Yellow]: { fill: '#e9e4d8', text: '#000000', contrast: '#000000' }
}

export const KoenigrufenUiRuntime: GameUIRuntime<
    KoenigrufenProjectedState,
    HydratedKoenigrufenGameState
> = {
    ...KoenigrufenRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: KoenigrufenGameSession,
    colorizer: new DefaultColorizer(),
    playerColorPalette: koenigrufenPlayerColorPalette
}
