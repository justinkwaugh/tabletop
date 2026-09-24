import { sameTileEndpoint } from '../tiles/topology.js'
import type { TileEndpoint, TileFace, TileNode, TilePath } from '../tiles/tile.js'

export type TileNodeMapping = Readonly<Record<string, string>>

export function sameStopCounts(before: TileFace, after: TileFace): boolean {
    return ['city', 'town', 'offboard'].every(
        (kind) =>
            before.nodes.filter((node) => node.kind === kind).length ===
            after.nodes.filter((node) => node.kind === kind).length
    )
}

export function tileUpgradeMappings(before: TileFace, after: TileFace): TileNodeMapping[] {
    const mappings: TileNodeMapping[] = []
    function visit(index: number, mapping: Record<string, string>) {
        const node = before.nodes[index]
        if (!node) {
            if (before.paths.every((path) => preservesPath(path, after, mapping)))
                mappings.push({ ...mapping })
            return
        }
        for (const target of after.nodes) {
            if (node.kind !== target.kind) continue
            if (
                Object.values(mapping).includes(target.id) &&
                (node.kind !== 'city' ||
                    before.nodes.filter((entry) => entry.kind === 'city').length <=
                        after.nodes.filter((entry) => entry.kind === 'city').length)
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

export function preservesPath(path: TilePath, after: TileFace, mapping: TileNodeMapping): boolean {
    const endpoints = path.endpoints.map(
        (end): TileEndpoint =>
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
            if (sameTileEndpoint(next.endpoints[0], current)) queue.push(next.endpoints[1])
            if (sameTileEndpoint(next.endpoints[1], current)) queue.push(next.endpoints[0])
        }
    }
    return false
}

export function fixedNodeRevenue(node: TileNode): number {
    return node.kind !== 'junction' && node.revenue.kind === 'fixed' ? node.revenue.amount : 0
}
