import type { MapLocation } from '../map/map.js'
import type { TileEdge, TileFace } from '../tiles/tile.js'
import type { TrackRules } from './trackConstruction.js'
import { tileUpgradeMappings, withoutStops, type TileNodeMapping } from './trackUpgrade.js'

export type TileReplacementRules = Pick<
    TrackRules,
    'colorOrder' | 'preservesStops' | 'upgradesWithinColor' | 'reconfigures' | 'removedStops'
>

/** The replaced face as its replacement must keep it: without the stops the title removes. */
export function keptFace(
    rules: Pick<TrackRules, 'removedStops'>,
    locationId: string,
    before: TileFace,
    after: TileFace
): TileFace {
    return withoutStops(before, rules.removedStops?.(locationId, before, after) ?? [])
}

export function replacesColorAndStops(
    rules: TileReplacementRules,
    locationId: string,
    before: TileFace,
    after: TileFace
): boolean {
    const colorStep = rules.colorOrder.indexOf(after.color) - rules.colorOrder.indexOf(before.color)
    if (colorStep === 0) return !!rules.upgradesWithinColor?.(locationId, before, after)
    return (
        colorStep === 1 &&
        (rules.preservesStops(keptFace(rules, locationId, before, after), after) ||
            !!rules.reconfigures?.(locationId, before, after))
    )
}

/** A tile of the colour carries the hex's label from that colour on, else the replaced tile's. */
export function requiredLabels(
    location: MapLocation,
    color: string,
    colorOrder: readonly string[],
    replacedLabels: readonly string[]
): readonly string[] {
    const upgradeLabel = location.upgradeLabels
        ?.filter((entry) => colorOrder.indexOf(entry.color) <= colorOrder.indexOf(color))
        .at(-1)
    if (!upgradeLabel) return replacedLabels
    return upgradeLabel.label ? [upgradeLabel.label] : []
}

export function sameLabels(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((label) => b.includes(label))
}

/** A town may become a city only within its colour, as a title's within-colour upgrade allows. */
export function replacementMappings(before: TileFace, after: TileFace): TileNodeMapping[] {
    return tileUpgradeMappings(before, after, { townsBecomeCities: before.color === after.color })
}

export function tileExits(face: TileFace): Set<TileEdge> {
    return new Set(
        face.paths.flatMap((path) =>
            path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
        )
    )
}

export function tileExitCount(face: TileFace): number {
    return tileExits(face).size
}

/** Whether every exit of the replaced tile remains an exit of its replacement. */
export function keepsExits(before: TileFace, after: TileFace): boolean {
    const kept = tileExits(after)
    return [...tileExits(before)].every((edge) => kept.has(edge))
}
