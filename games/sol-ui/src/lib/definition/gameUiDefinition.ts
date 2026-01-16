import { mountDynamicComponent, type GameUiDefinition } from '@tabletop/frontend-components'
import { Definition, HydratedSolGameState, SolGameState } from '@tabletop/sol'
import { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { SolGameColorizer } from './gameColorizer.js'
import Table from '../components/Table.svelte'
import coverImg from '$lib/images/sol-cover.jpg'

export const UiDefinition: GameUiDefinition<SolGameState, HydratedSolGameState> = Object.assign(
    {},
    Definition,
    {
        gameUI: {
            component: Table,
            mount: mountDynamicComponent
        },
        sessionClass: SolGameSession,
        colorizer: new SolGameColorizer(),
        thumbnailUrl: coverImg
    }
)
