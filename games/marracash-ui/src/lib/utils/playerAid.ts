import {
    AllAntiques,
    auctioneerCut,
    customerPayment,
    DirhamIncrement,
    LowAuctioneerCutLimit,
    LowMoverCutProfitLimit,
    MarketColor,
    MaxCustomerPayment,
    moverCut,
    paidAntiqueCount,
    PaymentPerCustomerStep,
    type Antique
} from '@tabletop/marracash'

export type AidAmountRow = { label: string; amount: number }
export type AntiqueValueRange = { color: MarketColor; lowest: number; highest: number }
export type AntiquePayoutRow = { place: string; paidCards: number }

const Places = ['1st', '2nd', '3rd', '4th', '5th']
const TopPaymentPlace = MaxCustomerPayment / PaymentPerCustomerStep

export function customerPayoutRows(): AidAmountRow[] {
    return Array.from({ length: TopPaymentPlace }, (_, index) => ({
        label: index === TopPaymentPlace - 1 ? `${Places[index]}+` : Places[index],
        amount: customerPayment(index + 1)
    }))
}

export function moverBonusRows(): AidAmountRow[] {
    const higherIncome = LowMoverCutProfitLimit + PaymentPerCustomerStep
    return [
        { label: `up to ${LowMoverCutProfitLimit}`, amount: moverCut(LowMoverCutProfitLimit, 1) },
        { label: `${higherIncome} or more`, amount: moverCut(higherIncome, 1) }
    ]
}

export function auctionBonusRows(): AidAmountRow[] {
    const higherBid = LowAuctioneerCutLimit + DirhamIncrement
    return [
        { label: `up to ${LowAuctioneerCutLimit}`, amount: auctioneerCut(LowAuctioneerCutLimit) },
        { label: `${higherBid} or more`, amount: auctioneerCut(higherBid) }
    ]
}

export function antiqueValueRanges(): AntiqueValueRange[] {
    return Object.values(MarketColor)
        .map((color) => {
            const values = AllAntiques.filter((card) => card.color === color).map(
                (card) => card.value
            )
            return { color, lowest: Math.min(...values), highest: Math.max(...values) }
        })
        .toSorted((a, b) => a.lowest - b.lowest)
}

export function antiquePayoutRows(playerCount: number): AntiquePayoutRow[] {
    return Array.from({ length: playerCount }, (_, rank) => ({
        place: Places[rank],
        paidCards: paidAntiqueCount(rank)
    }))
}

// Shaped like a dealt hand: two of one colour, one each of three others, none of the fifth
export const ExampleAntiqueHand: readonly Antique[] = [
    { color: MarketColor.Red, value: 100 },
    { color: MarketColor.Green, value: 125 },
    { color: MarketColor.Purple, value: 75 },
    { color: MarketColor.Purple, value: 150 },
    { color: MarketColor.Yellow, value: 175 }
]
