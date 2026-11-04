import type { TrackHex } from '../../model/components.js'
import { networkHexes, regionsReached } from '../../model/network.js'
import type { EditionMap } from '../editions.js'
import { HexKind, type CompanyId, type Industry } from '../types.js'

// The board's State Subsidies table, per share by the number of states reached.
export const STATE_SUBSIDIES: readonly number[] = [0, 0, 1, 2, 3, 5, 7, 9, 12, 15, 20, 27, 36]

export function stateSubsidyPerShare(
    companyId: CompanyId,
    track: readonly TrackHex[],
    map: EditionMap
): number {
    return STATE_SUBSIDIES[regionsReached(track, companyId, map)]
}

export function demandEstablished(
    industry: Industry,
    companyId: CompanyId,
    track: readonly TrackHex[],
    map: EditionMap
): boolean {
    return networkHexes(track, companyId).some((hex) =>
        map.demandAreasBeside(hex.coords).some((area) => area.industries.includes(industry))
    )
}

export function midwestTrackCost(hexKind: HexKind, discsBelow: number): number {
    return hexKind === HexKind.Countryside ? 2 : 4 + 2 * discsBelow
}
