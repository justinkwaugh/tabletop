import type { MoveOrder } from '@tabletop/napoleons-triumph'

interface Identified {
    id: string
}

/**
 * Units named in an action, as the game holds them. The order they were tapped in may follow the
 * player's reading order, strongest first, and the enemy sees the names of units they cannot see.
 */
export function inGameOrder(units: readonly Identified[], unitIds: readonly string[]): string[] {
    return units.flatMap((unit) => (unitIds.includes(unit.id) ? [unit.id] : []))
}

export function ordersInGameOrder<Order extends MoveOrder>(
    units: readonly Identified[],
    orders: readonly Order[]
): Order[] {
    return orders.map((order) => ({ ...order, unitIds: inGameOrder(units, order.unitIds) }))
}
