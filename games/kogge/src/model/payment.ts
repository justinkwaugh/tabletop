import * as Type from 'typebox'
import { GoodCounts, hasGoods, totalGoods } from '../components/goods.js'
import { containsMarkers } from '../components/routeMarkers.js'
import type { HydratedKoggePlayerState } from './playerState.js'

export type Payment = Type.Static<typeof Payment>
export const Payment = Type.Object({
    goods: GoodCounts,
    markers: Type.Array(Type.Integer({ minimum: 0 }))
})

export function paymentSize(payment: Payment): number {
    return totalGoods(payment.goods) + payment.markers.length
}

export function canAffordPayment(player: HydratedKoggePlayerState, payment: Payment): boolean {
    return hasGoods(player.goods, payment.goods) && containsMarkers(player.hand(), payment.markers)
}

export function canPayAnyItems(player: HydratedKoggePlayerState, count: number): boolean {
    return player.cargoCount() + player.markerCount >= count
}
