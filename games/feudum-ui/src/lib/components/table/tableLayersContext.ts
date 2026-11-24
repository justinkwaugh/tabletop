import { getContext, setContext } from 'svelte'
import type { TableLayers } from '$lib/model/tableLayers.svelte.js'

const Key = Symbol('feudum-table-layers')

export function setTableLayers(layers: TableLayers | undefined): void {
    setContext(Key, layers)
}

export function getTableLayers(): TableLayers | undefined {
    return getContext<TableLayers | undefined>(Key)
}
