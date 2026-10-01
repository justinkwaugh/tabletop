export const DirhamIncrement = 25
export const MinimumAuctionBid = 100
export const MaxShopsPerPlayer = 6

const PaymentPerCustomerStep = 100
const MaxCustomerPayment = 500
const LowAuctioneerCut = 100
const HighAuctioneerCut = 200
const LowAuctioneerCutLimit = 500

export function customerPayment(customerNumber: number): number {
    return Math.min(customerNumber * PaymentPerCustomerStep, MaxCustomerPayment)
}

export function auctioneerCut(winningBid: number): number {
    return winningBid <= LowAuctioneerCutLimit ? LowAuctioneerCut : HighAuctioneerCut
}

export function isWholeDirhamAmount(amount: number): boolean {
    return Number.isInteger(amount) && amount >= 0 && amount % DirhamIncrement === 0
}

const LowMoverCutPerCustomer = 50
const HighMoverCutPerCustomer = 100
const LowMoverCutProfitLimit = 300

export function moverCut(ownerIncome: number, customers: number): number {
    const perCustomer =
        ownerIncome <= LowMoverCutProfitLimit ? LowMoverCutPerCustomer : HighMoverCutPerCustomer
    return perCustomer * customers
}
