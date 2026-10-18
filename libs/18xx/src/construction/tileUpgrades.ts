import type { MapLocation } from '../map/map.js'
import type { TileDefinition } from '../tiles/tile.js'
import { rotateTileFace, TileEdges } from '../tiles/topology.js'
import type { TrackRules } from './trackConstruction.js'
import {
    replacementMappings,
    replacesColorAndStops,
    requiredLabels,
    sameLabels,
    tileExitCount,
    type TileReplacementRules
} from './tileReplacement.js'

export type TileUpgradeRules = TileReplacementRules &
    Pick<TrackRules, 'map' | 'tileSet' | 'mostExits'>

/**
 * Which tiles of the set may replace which on some hex of the map, by the colour, stop, label
 * and track rules of construction. What depends on the game, such as phases, private powers,
 * a title's restrictions and a hex's neighbours, is not considered.
 */
export class TileUpgrades {
    private readonly next = new Map<string, Set<string>>()
    private readonly previous = new Map<string, Set<string>>()
    private readonly keepsTrack = new Map<string, boolean>()

    constructor(private readonly rules: TileUpgradeRules) {
        for (const location of rules.map.definition.locations)
            if (location.buildable) this.addUpgradesOn(location)
    }

    upgradesTo(definitionId: string): readonly string[] {
        return [...(this.next.get(definitionId) ?? [])]
    }

    upgradesFrom(definitionId: string): readonly string[] {
        return [...(this.previous.get(definitionId) ?? [])]
    }

    chain(definitionId: string): ReadonlySet<string> {
        return new Set([
            ...this.reach(definitionId, (id) => this.upgradesFrom(id)),
            ...this.reach(definitionId, (id) => this.upgradesTo(id))
        ])
    }

    private reach(start: string, step: (id: string) => readonly string[]): Set<string> {
        const reached = new Set([start])
        for (const id of reached) for (const next of step(id)) reached.add(next)
        return reached
    }

    private addUpgradesOn(location: MapLocation) {
        const tiles = this.rules.tileSet.definitions.filter((tile) =>
            this.layableOn(location, tile)
        )
        for (const before of tiles) {
            const after = tiles.filter(
                (tile) =>
                    replacesColorAndStops(this.rules, location.id, before.face, tile.face) &&
                    this.keepsTrackOf(before, tile)
            )
            for (const tile of this.mostExitsWhereRequired(before, after)) this.add(before, tile)
        }
    }

    private layableOn(location: MapLocation, tile: TileDefinition): boolean {
        const { colorOrder } = this.rules
        const printed = location.preprintedTile
        return (
            colorOrder.indexOf(tile.face.color) > colorOrder.indexOf(printed.color) &&
            sameLabels(
                requiredLabels(location, tile.face.color, colorOrder, printed.labels),
                tile.face.labels
            )
        )
    }

    private keepsTrackOf(before: TileDefinition, after: TileDefinition): boolean {
        const key = `${before.id} ${after.id}`
        let keeps = this.keepsTrack.get(key)
        if (keeps === undefined) {
            keeps = TileEdges.some(
                (rotation) =>
                    replacementMappings(before.face, rotateTileFace(after.face, rotation)).length >
                    0
            )
            this.keepsTrack.set(key, keeps)
        }
        return keeps
    }

    private mostExitsWhereRequired(
        before: TileDefinition,
        after: readonly TileDefinition[]
    ): readonly TileDefinition[] {
        if (!this.rules.mostExits?.(before.face)) return after
        const most = (color: string) =>
            Math.max(
                ...after
                    .filter((tile) => tile.face.color === color)
                    .map((tile) => tileExitCount(tile.face))
            )
        return after.filter((tile) => tileExitCount(tile.face) === most(tile.face.color))
    }

    private add(before: TileDefinition, after: TileDefinition) {
        this.next.set(before.id, (this.next.get(before.id) ?? new Set()).add(after.id))
        this.previous.set(after.id, (this.previous.get(after.id) ?? new Set()).add(before.id))
    }
}
