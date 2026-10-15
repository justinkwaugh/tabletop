import type {
    GameUIRuntime,
    PlayerColorPalette
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Color } from '@tabletop/common'
import type {
    HydratedReefEncounterGameState,
    ReefEncounterProjectedState
} from '@tabletop/reef-encounter'
import { ReefEncounterRuntime } from '@tabletop/reef-encounter'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { ReefEncounterGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { ReefEncounterGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

// The painted wood of the shrimp pieces, measured from a photograph of them, with the red
// deepened and the green lightened so the two differ in lightness as well as hue and stay apart
// for red- and green-blind players.
const reefEncounterPlayerColorPalette: PlayerColorPalette = {
    [Color.Red]: { fill: '#a81c0c', text: '#ffffff', contrast: '#ffffff' },
    [Color.Yellow]: { fill: '#efe048', text: '#000000', contrast: '#000000' },
    [Color.Green]: { fill: '#4f9e55', text: '#000000', contrast: '#000000' },
    [Color.Purple]: { fill: '#58287a', text: '#ffffff', contrast: '#ffffff' }
}

export const ReefEncounterUiRuntime: GameUIRuntime<
    ReefEncounterProjectedState,
    HydratedReefEncounterGameState
> = {
    ...ReefEncounterRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: ReefEncounterGameSession,
    colorizer: new ReefEncounterGameColorizer(),
    playerColorPalette: reefEncounterPlayerColorPalette
}
