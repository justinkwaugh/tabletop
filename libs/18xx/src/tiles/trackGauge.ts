import type { TilePath, TrackGauge } from './tile.js'

/** A gauge a train runs on. Dual track carries either. */
export type RunningGauge = 'standard' | 'narrow'
export const RunningGauges: readonly RunningGauge[] = ['standard', 'narrow']

/**
 * The gauge a route runs on between two stops: that of the first standard or narrow track it
 * takes there, or ``either`` while all of that track is dual.
 */
export type StretchGauge = RunningGauge | 'either'

/** Gauges a train may run on along a path. */
export function pathRunningGauges(path: Pick<TilePath, 'gauge'>): readonly RunningGauge[] {
    if (path.gauge === 'dual') return RunningGauges
    return [path.gauge ?? 'standard']
}

/**
 * The stretch's gauge once it continues along the path, or undefined where the path's gauge
 * differs: a route changes gauge only at a stop, and dual track keeps the gauge it is entered on.
 */
export function continueStretch(
    stretch: StretchGauge,
    path: Pick<TilePath, 'gauge'>
): StretchGauge | undefined {
    if (path.gauge === 'dual') return stretch
    const gauge = path.gauge ?? 'standard'
    return stretch === 'either' || stretch === gauge ? gauge : undefined
}

/** Whether replacing track keeps a route the replaced track carried: the same gauge, or dual. */
export function keepsTrackGauge(
    replaced: TrackGauge | undefined,
    replacing: TrackGauge | undefined
): boolean {
    return replacing === 'dual' || replaced === replacing
}
