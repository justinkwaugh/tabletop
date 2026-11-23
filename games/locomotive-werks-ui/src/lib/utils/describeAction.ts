import { ActionSource, type GameAction } from '@tabletop/common'
import {
    DemandChange,
    SaleOutcome,
    isAdjustMarket,
    isDevelop,
    isExpandCapacity,
    isPassDevelopment,
    isPayTaxes,
    isShip,
    type CapacityPurchase,
    type LocomotiveId,
    type MarketStep,
    type ShipmentRecord
} from '@tabletop/locomotive-werks'

// A description reads as text with player names and locomotives spliced in.
export type DescriptionSegment = string | { playerId: string } | { locomotiveId: LocomotiveId }
export type Description = DescriptionSegment[]

function units(count: number): string {
    return `${count} unit${count === 1 ? '' : 's'}`
}

function shipmentNote(shipment: ShipmentRecord): string {
    switch (shipment.outcome) {
        case SaleOutcome.Matched:
        case SaleOutcome.Exceeded:
            return `filling the ${shipment.face}`
        case SaleOutcome.Reduced:
            return `the ${shipment.face} drops to ${shipment.face - shipment.units}`
    }
}

// What a shipment does to its order die, in a few words for the werk that ships it.
export function orderEffect(shipment: Pick<ShipmentRecord, 'face' | 'units' | 'outcome'>): string {
    return shipment.outcome === SaleOutcome.Reduced
        ? `${shipment.face} → ${shipment.face - shipment.units}`
        : `fills the ${shipment.face}`
}

export function describeShipment(shipment: ShipmentRecord): Description {
    return [
        `${units(shipment.units)} of`,
        { locomotiveId: shipment.locomotiveId },
        `for $${shipment.income}, ${shipmentNote(shipment)}`
    ]
}

function describeStep(step: MarketStep): Description {
    const rolled = step.rolls.length > 0 ? `, rolled ${step.rolls.join(', ')}` : ''
    switch (step.change) {
        case DemandChange.Obsolete:
            return [
                { locomotiveId: step.locomotiveId },
                `is obsolete: ${step.returned} dice return`
            ]
        case DemandChange.Shrunk:
            return [{ locomotiveId: step.locomotiveId }, `loses a die${rolled}`]
        case DemandChange.Filled:
            return [
                { locomotiveId: step.locomotiveId },
                step.added > 0 ? `gains ${step.added} dice${rolled}` : `keeps its dice${rolled}`
            ]
        case DemandChange.Grown:
            return [
                { locomotiveId: step.locomotiveId },
                step.added > 0 ? `gains a die${rolled}` : `is at its limit${rolled}`
            ]
    }
}

// The headline of an action, after the acting player's name where it has one.
export function describeAction(action: GameAction): Description {
    if (isDevelop(action)) {
        return [
            'developed',
            { locomotiveId: action.locomotiveId },
            `for $${action.metadata?.cost ?? 0}`
        ]
    }
    if (isPassDevelopment(action)) {
        return ['developed nothing']
    }
    if (isExpandCapacity(action)) {
        return action.purchases.length === 0
            ? ['bought no capacity']
            : [`spent $${action.metadata?.cost ?? 0} on capacity`]
    }
    if (isShip(action)) {
        const income = action.metadata?.income ?? 0
        if (action.locomotiveIds.length === 0) {
            return ['held back their locomotives']
        }
        return [
            `${action.source === ActionSource.System ? 'auto-shipped' : 'shipped'} for $${income}`
        ]
    }
    if (isPayTaxes(action)) {
        return [action.metadata?.gameOver ? 'Taxes paid: the game is over' : 'Taxes paid']
    }
    if (isAdjustMarket(action)) {
        return ['Market Demands']
    }
    return [action.type]
}

// The lines under an action's headline: what it set off or what it was made of.
export function describeDetails(action: GameAction): Description[] {
    if (isDevelop(action)) {
        const metadata = action.metadata
        const lines: Description[] = []
        if (metadata?.nextLocomotiveId !== undefined && metadata.nextRoll !== undefined) {
            lines.push([
                `New Initial Orders: a ${metadata.nextRoll} for`,
                { locomotiveId: metadata.nextLocomotiveId }
            ])
        }
        if (metadata?.retiredLocomotiveId !== undefined && (metadata.retiredCards ?? 0) > 0) {
            lines.push([
                `${metadata.retiredCards} unbought`,
                { locomotiveId: metadata.retiredLocomotiveId },
                `card${metadata.retiredCards === 1 ? '' : 's'} leave play`
            ])
        }
        return lines
    }
    if (isExpandCapacity(action)) {
        return action.purchases.flatMap((purchase, index) =>
            describePurchase(purchase, action.metadata?.purchases[index])
        )
    }
    if (isShip(action)) {
        return (action.metadata?.shipments ?? []).map(describeShipment)
    }
    if (isPayTaxes(action)) {
        const payments: Description[] = (action.metadata?.payments ?? []).map((payment) => [
            { playerId: payment.playerId },
            `pays $${payment.tax}, keeping $${payment.cash}`
        ])
        const order = action.metadata?.playerOrder ?? []
        if (order.length === 0) {
            return payments
        }
        const orderLine: Description = ['Player Order:']
        order.forEach((playerId, index) => {
            orderLine.push(index === 0 ? `${index + 1}.` : `· ${index + 1}.`, { playerId })
        })
        return [...payments, orderLine]
    }
    if (isAdjustMarket(action)) {
        return (action.metadata?.steps ?? []).map(describeStep)
    }
    return []
}

export function winVerb(winners: readonly string[], myPlayerId: string | undefined): string {
    if (winners.length > 1) {
        return 'win together'
    }
    return winners[0] === myPlayerId ? 'win' : 'wins'
}

function describePurchase(
    { locomotiveId, from, units: count }: CapacityPurchase,
    record?: { cost: number; closed: boolean }
): Description[] {
    const cost = `for $${record?.cost ?? 0}`
    if (from === undefined) {
        return [[`Added ${units(count)} to`, { locomotiveId }, cost]]
    }
    const lines: Description[] = [
        [`Upgraded ${units(count)} of`, { locomotiveId: from }, 'to', { locomotiveId }, cost]
    ]
    if (record?.closed) {
        lines.push([{ locomotiveId: from }, 'werk closes'])
    }
    return lines
}
