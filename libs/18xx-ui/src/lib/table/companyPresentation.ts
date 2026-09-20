import { companyMarketSpace, type StockMarket } from '@tabletop/18xx'

export type CompanyNameVariants = { short: string; initials: string; history?: string; card?: string }

export type NumberedShareNames = Readonly<Record<string, Readonly<Record<number, string>>>>

export type CompanyPricePresentation = {
    showPar: boolean
    label: string
    showInSpreadsheet: boolean
}

export const DefaultCompanyPricePresentation: CompanyPricePresentation = {
    showPar: true,
    label: 'Market',
    showInSpreadsheet: false
}

export function companySharePrice(market: StockMarket, companyId: string): number | undefined {
    return market.stacks.some((stack) => stack.companyIds.includes(companyId))
        ? companyMarketSpace(market, companyId).price
        : undefined
}
