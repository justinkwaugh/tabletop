import { Good } from './goods.js'

export const GOOD_REVENUE_BY_GOOD = {
    [Good.Rice]: 20,
    [Good.Spice]: 25,
    [Good.Rubber]: 30,
    [Good.SiapSaji]: 35,
    [Good.Oil]: 40
} satisfies Record<Good, number>

export const SHIPPING_FEE_PER_SHIP_USE = 5

export enum DeliveryTieBreakPolicy {
    MinShippingCost = 'min-shipping-cost',
    StableLexicographic = 'stable-lexicographic'
}

export const DEFAULT_DELIVERY_TIE_BREAK_POLICY = DeliveryTieBreakPolicy.MinShippingCost
