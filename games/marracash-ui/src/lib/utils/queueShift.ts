import type { GameAction } from '@tabletop/common'
import { isBringVisitors, QueueEnd, type MarketColor } from '@tabletop/marracash'

// How many visitors have been taken from the front of the queue: together with a visitor's place in
// line it names that visitor for the whole game, so the same visitor keeps the same element.
export function frontTaken(actions: readonly GameAction[]): number {
    return actions.reduce(
        (taken, action) =>
            isBringVisitors(action) && action.end === QueueEnd.Front ? taken + action.count : taken,
        0
    )
}

function endsWith(longer: readonly MarketColor[], shorter: readonly MarketColor[]): boolean {
    const offset = longer.length - shorter.length
    return shorter.every((color, index) => longer[offset + index] === color)
}

// How far the visitors still in line moved forward between two queues: the count taken from the
// front, or minus the count put back at the front when a front refill is undone. Zero when the
// queue changed only at its back.
export function frontShift(from: readonly MarketColor[], to: readonly MarketColor[]): number {
    const change = from.length - to.length
    if (change > 0 && endsWith(from, to)) return change
    if (change < 0 && endsWith(to, from)) return change
    return 0
}

// How many visitors left the back of the queue between two queues, or zero when it changed
// elsewhere.
export function backTrim(from: readonly MarketColor[], to: readonly MarketColor[]): number {
    const change = from.length - to.length
    return change > 0 && to.every((color, index) => from[index] === color) ? change : 0
}
