import type { CertificatePool } from '@tabletop/18xx'
import type { PhaseChartData } from '../phases/phaseChart.js'
import type {
    CompanyNameVariants,
    CompanyPricePresentation,
    NumberedShareNames
} from '../table/companyPresentation.js'

export type TitlePresentation = {
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
}
