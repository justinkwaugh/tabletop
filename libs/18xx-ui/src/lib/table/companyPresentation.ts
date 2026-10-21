import type { StockMarket, StockMarketChart, TitleNames } from '@tabletop/18xx'

export type CompanyNameVariants = {
    full: string
    short: string
    initials: string
}

export type CompanyNaming = { initials: string; short?: string }

const RedundantEnding = / (Railroad|Railway|Company|Transportation)$/

export function shortCompanyName(full: string): string {
    const short = full.replace(RedundantEnding, '')
    // A single word left, such as Erie or Georgia, reads as the place rather than the company.
    return short.includes(' ') ? short : full
}

export function companyNameVariants(
    names: Pick<TitleNames, 'company'>,
    companies: Readonly<Record<string, CompanyNaming>>
): Readonly<Record<string, CompanyNameVariants>> {
    return Object.fromEntries(
        Object.entries(companies).map(([id, naming]) => {
            const full = names.company(id)
            return [
                id,
                { full, short: naming.short ?? shortCompanyName(full), initials: naming.initials }
            ]
        })
    )
}

export type NumberedShareNames = Readonly<Record<string, Readonly<Record<number, string>>>>

export type CompanyPricePresentation = {
    showPar: boolean
    label: string
}

export const DefaultCompanyPricePresentation: CompanyPricePresentation = {
    showPar: true,
    label: 'Value'
}

export function companySharePrice(
    chart: StockMarketChart,
    market: StockMarket,
    companyId: string
): number | undefined {
    return market.stacks.some((stack) => stack.companyIds.includes(companyId))
        ? chart.companySpace(market, companyId).price
        : undefined
}
