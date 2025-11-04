import { type GameUiDefinition } from '@tabletop/frontend-components'
import { Definition } from '@tabletop/bridges-of-shangri-la'
import { BridgesGameSession } from '../model/BridgesGameSession.svelte.js'
import { BridgesGameColorizer } from './gameColorizer.js'
import coverImg from '$lib/images/bridges-cover.jpg'

export const UiDefinition: GameUiDefinition = Object.assign({}, Definition, {
    getTableComponent: async () => {
        return (await import('../components/Table.svelte')).default
    },
    sessionClass: BridgesGameSession,
    colorizer: new BridgesGameColorizer(),
    thumbnailUrl: coverImg
})
