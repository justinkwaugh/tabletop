import type { GameAction } from '@tabletop/common'
import type { CertificatePool, EighteenXXState } from '@tabletop/18xx'
import type { PhaseChartData } from '../phases/phaseChart.js'
import type { MoneyFormat } from '../presentation/money.js'
import type {
    CompanyNameVariants,
    CompanyPricePresentation,
    NumberedShareNames
} from '../table/companyPresentation.js'
import type { StockInstructionStopReason } from '@tabletop/18xx'
import type { TileSymbolName } from '../tiles/tileSymbols.js'

export type PrivateTokenPresentation = { companyId: string } | { tileSymbol: TileSymbolName }

export type TitleStopReason = Extract<StockInstructionStopReason, { code: 'title' }>

/** A round of the title's own that follows an operating round and is numbered after it. */
export type TitleRound = {
    name: string
    abbreviation: string
    inProgress: (state: EighteenXXState) => boolean
    starts: (action: GameAction) => boolean
    ends: (action: GameAction) => boolean
}

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
    instructionStopText?: (reason: TitleStopReason) => string
    privatePurchaseLabel?: string
    privatePurchaseHeading?: string
    privateTilePrompts?: Readonly<Record<string, string>>
    privateTokens?: Readonly<Record<string, PrivateTokenPresentation>>
    titleRounds?: readonly TitleRound[]
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
    /** Published train card art by train definition id, shown in place of purchase buttons. */
    publishedTrainImages?: Readonly<Record<string, string>>
    /** Train badge colours for the published presentation; a value may be any CSS background. */
    publishedTrainColors?: Readonly<Record<string, string>>
    /** Phase badge colours for the published presentation; defaults to publishedTrainColors. */
    publishedPhaseColors?: Readonly<Record<string, string>>
}
