import type {
    GameUIRuntime,
    PlayerColorPalette
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { HydratedIndonesiaGameState, IndonesiaGameState } from '@tabletop/indonesia'
import { Color } from '@tabletop/common'
import { IndonesiaRuntime } from '@tabletop/indonesia'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { IndonesiaGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { IndonesiaGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

const indonesiaPlayerColorPalette: PlayerColorPalette = {
    [Color.Blue]: {
        fill: '#90cace',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Red]: {
        fill: '#e55649',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Yellow]: {
        fill: '#e2d254',
        text: '#000000',
        contrast: '#000000'
    },
    [Color.Green]: {
        fill: '#50823c',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Purple]: {
        fill: '#aa387f',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Gray]: {
        fill: '#aaaaaa',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Orange]: {
        fill: '#e78e52',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Black]: {
        fill: '#444444',
        text: '#ffffff',
        contrast: '#ffffff'
    }
}

export const IndonesiaUiRuntime: GameUIRuntime<IndonesiaGameState, HydratedIndonesiaGameState> = {
    ...IndonesiaRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: IndonesiaGameSession,
    colorizer: new IndonesiaGameColorizer(),
    playerColorPalette: indonesiaPlayerColorPalette
}
