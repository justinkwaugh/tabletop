import { firstOfEach } from '$lib/utils/ids.js'

export interface Way {
    road: number[]
    entryId?: string
}

export enum WayStepKind {
    Entry = 'Entry',
    Locale = 'Locale'
}

/** The locales on either side of a step along its way: none before the first step, none after the place itself. */
interface AlongTheWay {
    before?: number
    after?: number
}

export type WayStep = AlongTheWay &
    (
        | { kind: WayStepKind.Entry; key: string; locale: number; entryId: string }
        | { kind: WayStepKind.Locale; key: string; locale: number }
    )

export interface WayChoice {
    settled?: Way
    next: WayStep[]
}

function stepsOf({ road, entryId }: Way): WayStep[] {
    return road.map((locale, index) => {
        const alongTheWay = { before: road[index - 1], after: road[index + 1] }
        return index === 0 && entryId !== undefined
            ? { kind: WayStepKind.Entry, key: `entry:${entryId}`, locale, entryId, ...alongTheWay }
            : { kind: WayStepKind.Locale, key: `locale:${locale}`, locale, ...alongTheWay }
    })
}

function stepsApart(ways: readonly Way[], index: number): WayStep[] {
    return firstOfEach(
        ways.flatMap((way) => stepsOf(way).at(index) ?? []),
        (step) => step.key
    )
}

/** Follows the ways from where they start: a step they all share is taken unasked, and where they part the next tap decides. */
export function traceWays(ways: readonly Way[], taps: readonly string[]): WayChoice {
    const longest = Math.max(0, ...ways.map((way) => way.road.length))
    let open = [...ways]
    let tapsLeft = [...taps]
    for (let index = 0; index < longest && open.length > 1; index++) {
        const steps = stepsApart(open, index)
        if (steps.length < 2) {
            continue
        }
        const [tap, ...later] = tapsLeft
        if (tap === undefined) {
            return { next: steps }
        }
        open = open.filter((way) => stepsOf(way).at(index)?.key === tap)
        tapsLeft = later
    }
    return { settled: open.at(0), next: [] }
}
