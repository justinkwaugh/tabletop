import { getContext, hasContext, setContext } from 'svelte'

export interface SideFold {
    readonly folded: boolean
}

const SIDE_FOLD = Symbol('side fold')

export function provideSideFold(fold: SideFold) {
    setContext(SIDE_FOLD, fold)
}

export function findSideFold(): SideFold | undefined {
    return hasContext(SIDE_FOLD) ? getContext<SideFold>(SIDE_FOLD) : undefined
}
