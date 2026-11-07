import { getContext, setContext } from 'svelte'
import type { TableLayers } from '$lib/model/tableLayers.svelte.js'

const Key = Symbol('feudum-table-layers')

export function setTableLayers(layers: TableLayers): void {
    setContext(Key, layers)
}

/** Absent outside a table, so a piece drawn alone stays a plain piece. */
export function getTableLayers(): TableLayers | undefined {
    return getContext<TableLayers | undefined>(Key)
}
