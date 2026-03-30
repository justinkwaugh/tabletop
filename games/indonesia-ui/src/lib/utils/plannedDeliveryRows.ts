type QuantifiedPlannedDeliveryRowSeed = {
    key: string
    quantity: number
    requiredQuantity: number
}

export function splitQuantifiedPlannedDeliveryRow<
    T extends QuantifiedPlannedDeliveryRowSeed
>(row: T): Array<
    Omit<T, 'key' | 'quantity' | 'requiredQuantity'> & {
        key: string
        quantity: 1
        required: boolean
        requiredQuantity: 0 | 1
        unitIndex: number
    }
> {
    const deliveryCount = Math.max(0, Math.trunc(row.quantity))
    const requiredCount = Math.max(0, Math.min(Math.trunc(row.requiredQuantity), deliveryCount))
    const { key, quantity: _quantity, requiredQuantity: _requiredQuantity, ...rest } = row

    return Array.from({ length: deliveryCount }, (_unused, unitIndex) => ({
        ...rest,
        key: `${key}:unit:${unitIndex}`,
        quantity: 1,
        required: unitIndex < requiredCount,
        requiredQuantity: unitIndex < requiredCount ? 1 : 0,
        unitIndex
    }))
}
