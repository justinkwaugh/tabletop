import type { ConstructionState, TrackRequest } from '@tabletop/18xx'
import { LondonLocationId, MetropolitanId } from './companies.js'
import { LondonNodeIds } from './faces.js'
import { LondonApproachLocationIds } from './map.js'
import { requireState1822 } from './state.js'
import { LondonTileIds1822, TileSet1822 } from './tiles.js'

const Yellow = 'yellow'

/** The side of each hex beside London that faces it, where its London station's track comes out (§1.2.3). */
const LondonSides: Readonly<Record<string, number>> = Object.fromEntries(
    LondonNodeIds.map((nodeId, side) => [LondonApproachLocationIds[nodeId], (side + 3) % 6])
)

/** Why a tile may not be laid as asked, whoever lays it and by what power. */
export function layRestriction1822(
    state: ConstructionState,
    request: TrackRequest
): string | undefined {
    // London's stations keep their sides (§1.2.3).
    if (LondonTileIds1822.includes(request.definitionId) && request.rotation !== 0)
        return 'London is developed in place.'
    if (request.locationId === LondonLocationId) return undefined
    // The Metropolitan Railway's home token is its track lay in its first turn (§5.6.7).
    const title = requireState1822(state)
    if (request.companyId === MetropolitanId && title.debutCompanyIds.includes(MetropolitanId))
        return 'Placing its home station is the Metropolitan Railway’s track lay this turn.'
    // The six hexes around London are kept for the adjoining companies: a yellow tile there
    // joins the London station's track (§5.10.7).
    const side = LondonSides[request.locationId]
    const face = TileSet1822.definitions.find((tile) => tile.id === request.definitionId)?.face
    if (side !== undefined && face?.color === Yellow) {
        const joined = face.paths.some((path) =>
            path.endpoints.some(
                (end) => end.kind === 'edge' && (end.edge + request.rotation) % 6 === side
            )
        )
        if (!joined) return 'A yellow tile beside London joins its London station’s track.'
    }
    return undefined
}
