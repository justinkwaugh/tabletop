import type { CertificatePool } from '@tabletop/18xx'
import type { PhaseChartData } from '../phases/phaseChart.js'
import type { MoneyFormat } from '../presentation/money.js'
import type {
    CompanyNameVariants,
    CompanyPricePresentation,
    NumberedShareNames
} from '../table/companyPresentation.js'

export type TitlePresentation = {
    money: MoneyFormat
    trainShortLabels?: Readonly<Record<string, string>>
    phaseChart: PhaseChartData
    trainColors: Readonly<Record<string, string>>
    phaseColors: Readonly<Record<string, string>>
    marketPoolId: string
    exchangePoolId?: string
    companyNames?: Readonly<Record<string, CompanyNameVariants>>
    companyPricePresentation?: CompanyPricePresentation
    numberedShareNames?: NumberedShareNames
    includedCompanyIds?: readonly string[]
    mapFocusExcludedCompanyIds?: readonly string[]
    portfolioCompanyIds?: readonly string[]
    includedPortfolioCompanyIds?: readonly string[]
    poolName?: (pool: CertificatePool) => string
    privatePurchaseLabel?: string
    privatePurchaseHeading?: string
    privateTilePrompts?: Readonly<Record<string, string>>
    /**
     * Published card artwork for the published presentation, keyed by private company id or
     * certificate id (for shares auctioned like privates). Shown in place of the generated card.
     */
    publishedCardImages?: Readonly<Record<string, string>>
}
