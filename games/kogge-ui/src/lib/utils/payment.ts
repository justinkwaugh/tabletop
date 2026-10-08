import { SailRouteKind, goodCounts, type Payment, type SailRoute } from '@tabletop/kogge'
import type { PaymentItem } from '$lib/model/selection.js'

export function paymentFromItems(items: readonly PaymentItem[]): Payment {
    const goods = goodCounts({})
    const markers: number[] = []
    for (const item of items) {
        if (item.kind === 'good') {
            goods[item.good] += 1
        } else {
            markers.push(item.value)
        }
    }
    return { goods, markers }
}

export function sameRoute(a: SailRoute, b: SailRoute | undefined): boolean {
    if (!b || a.kind !== b.kind) {
        return false
    }
    return (
        a.kind === SailRouteKind.SecretPassage ||
        (b.kind === SailRouteKind.Route && a.slot === b.slot)
    )
}
