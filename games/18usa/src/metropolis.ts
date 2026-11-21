import { shuffle, type Prng } from '@tabletop/common'
import type { TileRotation } from '@tabletop/18xx'

export type MetropolisCity = {
    locationId: string
    yellowTileId: string
    /** The yellow tile's rotation as set up, with its north arrow up. */
    rotation: TileRotation
    /** Denver's tile is turned by the first company to start there or connect to it (§12.2.3). */
    orientationChosen?: true
    /** The label of the green, brown and gray tiles that upgrade it. */
    upgradeLabel: string
}

/** The six cities that may become metropolises (§2.4); New York always is one. */
export const MetropolisCandidates: readonly MetropolisCity[] = [
    { locationId: 'H22', yellowTileId: '18usa:X01', rotation: 0, upgradeLabel: 'B' },
    { locationId: 'D20', yellowTileId: '18usa:X02', rotation: 1, upgradeLabel: 'B' },
    { locationId: 'H14', yellowTileId: '18usa:X03', rotation: 0, upgradeLabel: 'DFW' },
    {
        locationId: 'E11',
        yellowTileId: '18usa:X04',
        rotation: 0,
        orientationChosen: true,
        upgradeLabel: 'B'
    },
    { locationId: 'G3', yellowTileId: '18usa:X05', rotation: 3, upgradeLabel: 'LA' },
    { locationId: 'I19', yellowTileId: '18usa:X06', rotation: 0, upgradeLabel: 'B' }
]

export const MetropolisCount = 3

export type MetropolisSelection = {
    /** The candidates whose tiles go on the map. */
    metropolisIds: readonly string[]
    /** The others, whose tiles go with P10 Carnegie Steel when it is in play. */
    remainingIds: readonly string[]
}

export function selectMetropolises(prng: Prng): MetropolisSelection {
    const candidateIds = MetropolisCandidates.map((candidate) => candidate.locationId)
    const drawn = [...candidateIds]
    shuffle(drawn, prng.random)
    const chosen = drawn.slice(0, MetropolisCount)
    return {
        metropolisIds: candidateIds.filter((id) => chosen.includes(id)),
        remainingIds: candidateIds.filter((id) => !chosen.includes(id))
    }
}
