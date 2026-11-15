import type { TrackHex } from '../../model/components.js'
import type { EditionMap } from '../editions.js'
import { HexKind, type CompanyId } from '../types.js'

export function railroadBonus(
    companyId: CompanyId,
    track: readonly TrackHex[],
    map: EditionMap
): number {
    return track
        .filter(
            (hex) =>
                map.hex(hex.coords).kind !== HexKind.Countryside && hex.discs.at(-1) === companyId
        )
        .reduce((sum, hex) => sum + hex.discs.length - 1, 0)
}
