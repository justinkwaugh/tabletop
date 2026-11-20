import {
    Market1880,
    MajorIds1880,
    ParSlotsPerPrice,
    ParSpaceIds1880,
    requireState1880
} from '@tabletop/1880'
import { getCompany, nextOperatingCompany } from '@tabletop/18xx'

/**
 * Where a major on the operating order list stands this operating round: not yet floated, already
 * operated, the company whose turn is under way (or waits through a share round), or still to
 * operate.
 */
export type OperatingStanding = 'unfloated' | 'operated' | 'current' | 'waiting'

export type OperatingOrderSlot = {
    /** Its place in the list, 1 the top ¥100 slot (§IX). */
    place: number
    companyId?: string
    standing?: OperatingStanding
    /** The company that last bought a train from the bank (§X Purchase of Trains). */
    trainMarker: boolean
}

export type OperatingOrderRow = { price: number; slots: OperatingOrderSlot[] }

export type OperatingOrderView = {
    rows: OperatingOrderRow[]
    trainMarkerId?: string
    /** Once the last 8-train has left the bank, the operating round the game ends in (§XV). */
    finalRound?: number
}

/**
 * The operating order list printed at the board's left edge (§IX, §XII): four slots at each par price,
 * each holding the major whose director chose it, with the train marker beside the company that
 * last bought a train from the bank (§X).
 */
export function operatingOrderList(stateObject: object): OperatingOrderView {
    const state = requireState1880(stateObject)
    const set = state.operatingSet
    const current = nextOperatingCompany(state)
    const holders = new Map<string, string>()
    for (const companyId of MajorIds1880) {
        const company = getCompany(state, companyId)
        const slot = state.parSlots[companyId]
        if (company.parPrice === undefined || slot === undefined || company.closed) continue
        holders.set(`${company.parPrice}:${slot}`, companyId)
    }
    const standing = (companyId: string): OperatingStanding => {
        if (!getCompany(state, companyId).floated) return 'unfloated'
        if (companyId === current) return 'current'
        if (set && !set.completed && set.completedCompanyIds.includes(companyId)) return 'operated'
        return 'waiting'
    }
    const rows = ParSpaceIds1880.map((spaceId, priceIndex) => {
        const price = Market1880.space(spaceId).price
        const slots = Array.from({ length: ParSlotsPerPrice }, (_, slot): OperatingOrderSlot => {
            const place = priceIndex * ParSlotsPerPrice + slot + 1
            const companyId = holders.get(`${price}:${slot}`)
            if (!companyId) return { place, trainMarker: false }
            return {
                place,
                companyId,
                standing: standing(companyId),
                trainMarker: state.trainMarker === companyId
            }
        })
        return { price, slots }
    })
    return {
        rows,
        trainMarkerId: state.trainMarker,
        finalRound: state.lastEightRound === undefined ? undefined : state.lastEightRound + 3
    }
}
