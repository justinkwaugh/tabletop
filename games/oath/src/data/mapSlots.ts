import { Region } from '../model/oathEnums.js'

// R-2.1.1, R-9.4 — a slot's site card may be facedown, its identity in the vault.
export const SLOTS_PER_REGION: Readonly<Record<Region, number>> = {
    [Region.Cradle]: 2,
    [Region.Provinces]: 3,
    [Region.Hinterland]: 3
}

export const TOTAL_MAP_SLOTS = Object.values(SLOTS_PER_REGION).reduce((a, b) => a + b, 0)

/** Not a card id: `kindOf` parses a card's kind off the first segment. */
export function mapSlotId(region: Region, index: number): string {
    return `slot.${region}.${index}`
}

export function mapSlotsFor(region: Region): string[] {
    return Array.from({ length: SLOTS_PER_REGION[region] }, (_, i) => mapSlotId(region, i))
}

export function allMapSlots(): Record<Region, string[]> {
    return {
        [Region.Cradle]: mapSlotsFor(Region.Cradle),
        [Region.Provinces]: mapSlotsFor(Region.Provinces),
        [Region.Hinterland]: mapSlotsFor(Region.Hinterland)
    }
}

/** R-1.23.1, R-1.12 — always dealt faceup, whatever the variant. */
export const TOP_CRADLE_SLOT = mapSlotId(Region.Cradle, 0)
