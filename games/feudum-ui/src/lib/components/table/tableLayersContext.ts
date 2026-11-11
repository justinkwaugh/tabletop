import { getContext, setContext } from 'svelte'
import type { TableLayers } from '$lib/model/tableLayers.svelte.js'

const Key = Symbol('feudum-table-layers')

/** `undefined` inside the enlarged view, so what it draws stays plain. */
export function setTableLayers(layers: TableLayers | undefined): void {
    setContext(Key, layers)
}

/** Absent outside a table, so a piece drawn alone stays a plain piece. */
export function getTableLayers(): TableLayers | undefined {
    return getContext<TableLayers | undefined>(Key)
}
