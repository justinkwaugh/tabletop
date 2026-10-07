import { MediaQuery } from 'svelte/reactivity'
import { TableDisplayScale } from '$lib/utils/boardGeometry.js'

// Only a large screen shows the table near its natural size, so only there is it drawn larger.
// Phones and small tablets draw it at its layout size: drawn larger, its stacked layers outgrow
// the graphics memory iOS allows a page, which then crashes and reloads in a loop.
const largeScreen = new MediaQuery('(min-width: 1024px) and (min-height: 700px)')

export function tableDisplayScale(): number {
    return largeScreen.current ? TableDisplayScale : 1
}
