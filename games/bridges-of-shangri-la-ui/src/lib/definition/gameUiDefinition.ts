import { type GameUiDefinition } from '@tabletop/frontend-components'
import { BridgesDefinition } from '@tabletop/bridges-of-shangri-la'
import { BridgesGameSession } from '../model/BridgesGameSession.svelte.js'
import { BridgesGameColorizer } from './gameColorizer.js'
import coverImg from '$lib/images/bridges-cover.jpg'

export const BridgesUiDefinition: GameUiDefinition = Object.assign({}, BridgesDefinition, {
    getTableComponent: async () => {
        return (await import('../components/Table.svelte')).default
    },
    sessionClass: BridgesGameSession,
    colorizer: new BridgesGameColorizer(),
    thumbnailUrl: coverImg
})
