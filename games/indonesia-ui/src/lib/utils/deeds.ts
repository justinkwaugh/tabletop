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
