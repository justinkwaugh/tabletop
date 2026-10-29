export type MoneyFormat = (amount: number) => string

export function moneyFormat(symbol: string, placement: 'before' | 'after' = 'before'): MoneyFormat {
    return (amount) => {
        const grouped = amount.toLocaleString('en-US')
        return placement === 'before' ? `${symbol}${grouped}` : `${grouped}${symbol}`
    }
}

export function currencyAffixes(money: MoneyFormat): { before: string; after: string } {
    const [before = '', after = ''] = money(0).split('0')
    return { before, after }
}

export function cashText(money: MoneyFormat, cash: number | 'unlimited' | undefined): string {
    return cash === undefined ? '—' : cash === 'unlimited' ? '∞' : money(cash)
}

export function optionalMoney(money: MoneyFormat, amount: number | undefined): string {
    return amount === undefined ? '' : money(amount)
}
