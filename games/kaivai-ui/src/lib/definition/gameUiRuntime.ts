import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { HydratedKaivaiGameState, KaivaiGameState } from '@tabletop/kaivai'
import { KaivaiRuntime } from '@tabletop/kaivai'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { KaivaiGameColorizer } from './gameColorizer.js'
import Table from '../components/Table.svelte'
import { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte.js'

export const KaivaiUiRuntime: GameUIRuntime<KaivaiGameState, HydratedKaivaiGameState> = {
    ...KaivaiRuntime,
    gameUI: {
        component: Table,
        load: async () => Table,
        mount: mountDynamicComponent
    },
    sessionClass: KaivaiGameSession,
    colorizer: new KaivaiGameColorizer()
}
