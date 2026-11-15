import type { CompanyId } from '../editions/types.js'
import type { EditionMap } from '../editions/editions.js'
import type { TrackHex } from './components.js'

export function holdsTrack(hex: TrackHex, companyId: CompanyId): boolean {
    return hex.discs.includes(companyId) || hex.cube === companyId
}

export function networkHexes(track: readonly TrackHex[], companyId: CompanyId): TrackHex[] {
    return track.filter((hex) => holdsTrack(hex, companyId))
}

export function regionsReached(
    track: readonly TrackHex[],
    companyId: CompanyId,
    map: EditionMap
): number {
    const regions = networkHexes(track, companyId).flatMap((hex) => {
        const regionId = map.hex(hex.coords).regionId
        return regionId === undefined ? [] : [regionId]
    })
    return new Set(regions).size
}
