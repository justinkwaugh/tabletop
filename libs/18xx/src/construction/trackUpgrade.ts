import { sameTileEndpoint } from '../tiles/topology.js'
import type { TileEndpoint, TileFace, TileNode, TilePath } from '../tiles/tile.js'
import { keepsTrackGauge } from '../tiles/trackGauge.js'

export type TileNodeMapping = Readonly<Record<string, string>>

export function sameStopCounts(before: TileFace, after: TileFace): boolean {
    return ['city', 'town', 'offboard'].every(
        (kind) =>
            before.nodes.filter((node) => node.kind === kind).length ===
            after.nodes.filter((node) => node.kind === kind).length
    )
}

/**
 * The node mappings preserving a tile's track and stops; ``townsBecomeCities`` lets a town map
 * onto a city, as when a title promotes a town within its colour.
 */
export function tileUpgradeMappings(
    before: TileFace,
    after: TileFace,
    options: { townsBecomeCities?: boolean } = {}
): TileNodeMapping[] {
    const mappings: TileNodeMapping[] = []
    const count = (face: TileFace, kind: TileNode['kind']) =>
        face.nodes.filter((node) => node.kind === kind).length
    const citiesMerge = count(before, 'city') > count(after, 'city')
    function visit(index: number, mapping: Record<string, string>) {
        const node = before.nodes[index]
        if (!node) {
            if (before.paths.every((path) => preservesPath(path, after, mapping)))
                mappings.push({ ...mapping })
            return
        }
        for (const target of after.nodes) {
            // A terminal inside a tile, such as Boston's or Portland's, may become a city.
            const joinsCity = node.kind === 'offboard' && target.kind === 'city'
            if (
                node.kind !== target.kind &&
                !joinsCity &&
                !(options.townsBecomeCities && node.kind === 'town' && target.kind === 'city')
            )
                continue
            if (
                Object.values(mapping).includes(target.id) &&
                !joinsCity &&
                (node.kind !== 'city' || !citiesMerge)
            )
                continue
            mapping[node.id] = target.id
            visit(index + 1, mapping)
            delete mapping[node.id]
        }
    }
    visit(0, {})
    return mappings
}

/**
 * Whether the replacing face still runs the path between its mapped ends, through junctions, on
 * track that keeps the path's gauge.
 */
export function preservesPath(path: TilePath, after: TileFace, mapping: TileNodeMapping): boolean {
    const endpoints = path.endpoints.map((end): TileEndpoint =>
        end.kind === 'node' ? { kind: 'node', nodeId: mapping[end.nodeId] } : end
    )
    const visited: TileEndpoint[] = []
    const queue = [endpoints[0]]
    while (queue.length) {
        const current = queue.shift()!
        if (sameTileEndpoint(current, endpoints[1])) return true
        if (visited.some((end) => sameTileEndpoint(end, current))) continue
        visited.push(current)
        if (
            !sameTileEndpoint(current, endpoints[0]) &&
            (current.kind === 'edge' ||
                after.nodes.find((node) => node.id === current.nodeId)?.kind !== 'junction')
        )
            continue
        for (const next of after.paths) {
            if (!keepsTrackGauge(path.gauge, next.gauge)) continue
            if (sameTileEndpoint(next.endpoints[0], current)) queue.push(next.endpoints[1])
            if (sameTileEndpoint(next.endpoints[1], current)) queue.push(next.endpoints[0])
        }
    }
    return false
}

/**
 * The track a replacing face adds: its paths that do not run where track of the replaced face
 * kept by their gauge did, as standard or narrow track becoming dual. ``mapping`` maps the
 * replaced face's nodes onto the replacing face's, as a lay's node mapping does.
 */
export function addedTrack(
    before: TileFace,
    after: TileFace,
    mapping: TileNodeMapping
): readonly TilePath[] {
    const reverse = Object.fromEntries(Object.entries(mapping).map(([id, target]) => [target, id]))
    return after.paths.filter((path) => !preservesPath(path, before, reverse))
}

export function fixedNodeRevenue(node: TileNode): number {
    return node.kind !== 'junction' && node.revenue.kind === 'fixed' ? node.revenue.amount : 0
}
