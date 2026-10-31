import { assert } from '@tabletop/common'
import { sharePriceAt } from '../components/priceTrack.js'
import { RAILROAD_IDS, type RailroadId } from '../components/railroads.js'
import { REPAIRS_EVENT } from '../components/townTiles.js'
import type { PromontoryPointProjectedState } from '../model/gameState.js'
import type { PromontoryPointProjectedPlayerState } from '../model/playerState.js'

type Shares = PromontoryPointProjectedPlayerState['shares']
type PriceIndex = PromontoryPointProjectedState['priceIndex']
type DebtorHoldings = Pick<PromontoryPointProjectedPlayerState, 'money' | 'shares'>

export enum SaleListRefusal {
    NotHeld = 'NotHeld',
    SoldAfterAbleToPay = 'SoldAfterAbleToPay',
    StoppedWhileShort = 'StoppedWhileShort'
}

export type RepairsSettlement = {
    proceeds: number[]
    raised: number
    paid: number
    forgiven: number
}

// R-4.2, R-4.3-H1: fixed from the shares held when the tile is reached.
export function repairsBill(shares: Shares, railroadId: RailroadId): number {
    return REPAIRS_EVENT.dollarsPerShare * shares[railroadId]
}

// R-4.3, R-4.3-H2: half the price, rounded down; a distress sale never moves the price (R-3.2).
export function distressSaleProceeds(priceIndex: PriceIndex, railroadId: RailroadId): number {
    return Math.floor(sharePriceAt(priceIndex[railroadId]) / 2)
}

// R-4.3, R-4.3-H1 to H3: sell until able to pay, or sell every share and still fall short.
export function saleListRefusal(
    holdings: DebtorHoldings,
    owed: number,
    priceIndex: PriceIndex,
    sales: RailroadId[]
): SaleListRefusal | undefined {
    assertShort(holdings, owed)
    if (
        RAILROAD_IDS.some(
            (railroadId) => soldCount(sales, railroadId) > holdings.shares[railroadId]
        )
    ) {
        return SaleListRefusal.NotHeld
    }
    if (holdings.money + raisedBy(sales, priceIndex) >= owed) {
        const raisedBeforeLastSale = raisedBy(sales.slice(0, -1), priceIndex)
        return holdings.money + raisedBeforeLastSale >= owed
            ? SaleListRefusal.SoldAfterAbleToPay
            : undefined
    }
    return sellsEveryShare(holdings.shares, sales) ? undefined : SaleListRefusal.StoppedWhileShort
}

// R-4.3-H1, R-4.3-H3: pay the fixed bill, or all they have with the rest forgiven.
export function settleRepairs(
    holdings: DebtorHoldings,
    owed: number,
    priceIndex: PriceIndex,
    sales: RailroadId[]
): RepairsSettlement {
    assertShort(holdings, owed)
    const proceeds = sales.map((railroadId) => distressSaleProceeds(priceIndex, railroadId))
    const raised = sum(proceeds)
    const paid = Math.min(owed, holdings.money + raised)
    return { proceeds, raised, paid, forgiven: owed - paid }
}

// R-4.3: a debtor's money is below the bill.
function assertShort(holdings: DebtorHoldings, owed: number) {
    assert(holdings.money < owed, 'A debtor has less money than the Repairs bill')
}

export function raisedBy(sales: readonly RailroadId[], priceIndex: PriceIndex): number {
    return sum(sales.map((railroadId) => distressSaleProceeds(priceIndex, railroadId)))
}

export function soldCount(sales: readonly RailroadId[], railroadId: RailroadId): number {
    return sales.filter((sold) => sold === railroadId).length
}

function sellsEveryShare(shares: Shares, sales: RailroadId[]): boolean {
    return RAILROAD_IDS.every((railroadId) => soldCount(sales, railroadId) === shares[railroadId])
}

function sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0)
}
