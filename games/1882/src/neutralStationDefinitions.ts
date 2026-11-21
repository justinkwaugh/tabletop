import type { NeutralStation } from '@tabletop/18xx'
import { CnId, CnorId, GtpId, HbrId, QlId, ScrId } from './ids.js'

/** The companies with a neutral station on their charters (§10.4). */
export const NeutralHolders1882: readonly string[] = [CnorId, GtpId, HbrId, QlId, ScrId]

/** The neutral stations: one on each holder's charter and one in the supply (§2, §10.4). */
export function neutralStationId(holderId?: string): string {
    return `${CnId}:neutral:${holderId ?? 'supply'}`
}

/** Each neutral station with the company that holds and places it; the supply's has none. */
export const NeutralStations1882: readonly NeutralStation[] = [
    ...NeutralHolders1882,
    undefined
].map((holderId) => ({
    stationId: neutralStationId(holderId),
    ...(holderId ? { heldBy: holderId } : {})
}))
