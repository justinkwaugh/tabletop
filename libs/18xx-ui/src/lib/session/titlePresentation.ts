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
    /** Smaller versions of ``publishedCardImages`` for inline display; falls back to the full image. */
    publishedCardThumbnails?: Readonly<Record<string, string>>
    /** Published share and president certificate art by company id. */
    publishedShareImages?: Readonly<Record<string, { share: string; president: string }>>
    /** Smaller versions of ``publishedShareImages`` for inline display; falls back to the full image. */
    publishedShareThumbnails?: Readonly<Record<string, { share: string; president: string }>>
    /** Train badge colours for the published presentation; a value may be any CSS background. */
    publishedTrainColors?: Readonly<Record<string, string>>
    /** Phase badge colours for the published presentation; defaults to publishedTrainColors. */
    publishedPhaseColors?: Readonly<Record<string, string>>
}
