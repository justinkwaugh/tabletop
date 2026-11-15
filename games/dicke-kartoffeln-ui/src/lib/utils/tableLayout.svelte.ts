import { MediaQuery } from 'svelte/reactivity'

// Narrow screens stack the farm, the market and the other farms in one column.
export const compactTable = new MediaQuery('(max-width: 900px)')
