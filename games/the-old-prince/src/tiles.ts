import {
    parseTileDefinition,
    StandardTileCatalog,
    type TileDefinition,
    type TileEdge
} from '@tabletop/18xx'

export const TheOldPrinceTileSpecimens: readonly TileDefinition[] = Object.freeze([
    ...['3', '5', '6', '7', '8', '9', '16'].map((number) =>
        StandardTileCatalog.get(`18xx:${number}`)
    ),
    parseTileDefinition({
        id: 'the-old-prince:PEI1',
        printedNumber: 'PEI1',
        aliases: [],
        scope: 'The Old Prince 1871',
        face: {
            color: 'green',
            nodes: [
                {
                    id: 'city',
                    kind: 'city',
                    stationSlots: 2,
                    revenue: { kind: 'fixed', amount: 20 }
                }
            ],
            paths: ([0, 1, 3, 4] satisfies TileEdge[]).map((edge) => ({
                id: `edge-${edge}`,
                endpoints: [
                    { kind: 'edge', edge },
                    { kind: 'node', nodeId: 'city' }
                ]
            })),
            labels: []
        }
    } satisfies TileDefinition)
])
