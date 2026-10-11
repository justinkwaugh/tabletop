import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import {
    NapoleonsTriumphRuntime,
    type HydratedNapoleonsTriumphGameState,
    type NapoleonsTriumphProjectedState
} from '@tabletop/napoleons-triumph'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { NapoleonsTriumphColorizer } from './colorizer.js'
import { NapoleonsTriumphPalette } from './palette.js'
import GameTable from '../components/GameTable.svelte'
import { NapoleonsTriumphGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const NapoleonsTriumphUiRuntime: GameUIRuntime<
    NapoleonsTriumphProjectedState,
    HydratedNapoleonsTriumphGameState
> = {
    ...NapoleonsTriumphRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: NapoleonsTriumphGameSession,
    colorizer: new NapoleonsTriumphColorizer(),
    playerColorPalette: NapoleonsTriumphPalette
}
