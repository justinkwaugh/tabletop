import { assert, deepFreeze } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { Clone } from 'typebox/value'
import { TileDefinition, TileFace } from './tile.js'
import { sameTileEndpoint } from './topology.js'

const TileFaceValidator = Compile(TileFace)
const TileDefinitionValidator = Compile(TileDefinition)

export function parseTileFace(value: unknown): TileFace {
    assert(TileFaceValidator.Check(value), 'Invalid tile face schema')
    assertTileTopology(value)
    const face = Clone(value)
    deepFreeze(face)
    return face
}

export function parseTileDefinition(value: unknown): TileDefinition {
    assert(TileDefinitionValidator.Check(value), 'Invalid tile definition schema')
    assertTileTopology(value.face)
    const definition = Clone(value)
    deepFreeze(definition)
    return definition
}

export function assertTileTopology(face: TileFace): void {
    const nodeIds = new Set(face.nodes.map((node) => node.id))
    assert(nodeIds.size === face.nodes.length, 'Duplicate tile node ID')
    assert(
        new Set(face.paths.map((path) => path.id)).size === face.paths.length,
        'Duplicate tile path ID'
    )
    for (const node of face.nodes) {
        if (node.kind !== 'junction' && node.revenue.kind === 'staged') {
            const stages = node.revenue.values.map((value) => value.stage)
            assert(
                new Set(stages).size === stages.length,
                `Duplicate revenue stage on node ${node.id}`
            )
        }
    }
    for (const path of face.paths) {
        assert(!sameTileEndpoint(...path.endpoints), `Path ${path.id} has identical endpoints`)
        for (const endpoint of path.endpoints) {
            assert(
                endpoint.kind === 'edge' || nodeIds.has(endpoint.nodeId),
                `Path ${path.id} references an unknown node`
            )
        }
    }
}
