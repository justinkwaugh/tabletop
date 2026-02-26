import { CompanyType, Era, type AnyDeed } from '@tabletop/indonesia'

export const SHIPPING_ERA_ORDER = [Era.A, Era.B, Era.C] as const

export type ShippingEra = (typeof SHIPPING_ERA_ORDER)[number]

export type ShippingSizeEntry = {
    era: ShippingEra
    size: number
}

export function deedPositionKey(regionId: string, deedType: CompanyType): string {
    return `${regionId}:${deedType}`
}

export function shippingSizeEntriesFromRecord(
    sizes: Partial<Record<ShippingEra, number>>
): readonly ShippingSizeEntry[] {
    return SHIPPING_ERA_ORDER.flatMap((era) => {
        const size = sizes[era]
        if (typeof size !== 'number') {
            return []
        }
        return [{ era, size }]
    })
}

export function shippingSizeEntriesFromDeed(deed: AnyDeed): readonly ShippingSizeEntry[] | null {
    if (deed.type !== CompanyType.Shipping) {
        return null
    }
    return shippingSizeEntriesFromRecord(deed.sizes)
}

export function shippingSizeTotalsFromDeeds(deeds: readonly AnyDeed[]): readonly ShippingSizeEntry[] {
    const totals: Record<ShippingEra, number> = {
        [Era.A]: 0,
        [Era.B]: 0,
        [Era.C]: 0
    }

    for (const deed of deeds) {
        if (deed.type !== CompanyType.Shipping) {
            continue
        }
        for (const era of SHIPPING_ERA_ORDER) {
            totals[era] += deed.sizes[era] ?? 0
        }
    }

    return SHIPPING_ERA_ORDER.map((era) => ({
        era,
        size: totals[era]
    }))
}
