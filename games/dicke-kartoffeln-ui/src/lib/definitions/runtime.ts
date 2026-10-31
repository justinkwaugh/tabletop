import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import {
    DickeKartoffelnRuntime,
    type DickeKartoffelnProjectedState,
    type HydratedDickeKartoffelnGameState
} from '@tabletop/dicke-kartoffeln'
import { DefaultColorizer } from '@tabletop/frontend-components'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { DickeKartoffelnPalette } from './palette.js'
import GameTable from '../components/GameTable.svelte'
import { DickeKartoffelnGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const DickeKartoffelnUiRuntime: GameUIRuntime<
    DickeKartoffelnProjectedState,
    HydratedDickeKartoffelnGameState
> = {
    ...DickeKartoffelnRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: DickeKartoffelnGameSession,
    colorizer: new DefaultColorizer(),
    playerColorPalette: DickeKartoffelnPalette
}
