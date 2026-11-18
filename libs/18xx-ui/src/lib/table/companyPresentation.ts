import type { StockMarket, StockMarketChart, StockMarketSpace, TitleNames } from '@tabletop/18xx'

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
    /** Keeps Par in the spreadsheet once the IPO sells out, where par still prices company actions. */
    parWithoutIpoShares?: true
    /** Whether a company has left its par price behind, as an 1828 system has. */
    parRetired?: (state: object, companyId: string) => boolean
    label: string
}

export const DefaultCompanyPricePresentation: CompanyPricePresentation = {
    showPar: true,
    label: 'Value'
}

/** For titles whose shares always sell at the current price, with no par value. */
export const NoParCompanyPricePresentation: CompanyPricePresentation = {
    showPar: false,
    label: 'Value'
}

/** The par price the table shows for a company, if it still has one. */
export function shownParPrice(
    presentation: CompanyPricePresentation,
    state: object,
    company: { id: string; parPrice?: number }
): number | undefined {
    return presentation.parRetired?.(state, company.id) ? undefined : company.parPrice
}

export function companyMarketSpace(
    chart: StockMarketChart,
    market: StockMarket,
    companyId: string
): StockMarketSpace | undefined {
    return market.stacks.some((stack) => stack.companyIds.includes(companyId))
        ? chart.companySpace(market, companyId)
        : undefined
}

export function companySharePrice(
    chart: StockMarketChart,
    market: StockMarket,
    companyId: string
): number | undefined {
    return companyMarketSpace(chart, market, companyId)?.price
}
