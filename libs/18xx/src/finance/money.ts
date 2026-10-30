export type MoneyFormat = (amount: number) => string

export function moneyFormat(symbol: string, placement: 'before' | 'after' = 'before'): MoneyFormat {
    return (amount) => {
        const grouped = amount.toLocaleString('en-US')
        return placement === 'before' ? `${symbol}${grouped}` : `${grouped}${symbol}`
    }
}
