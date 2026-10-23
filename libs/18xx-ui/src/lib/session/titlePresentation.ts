import type { OperatingStepStatuses } from '../table/operatingStepStatuses.js'
import type { MarketCellDimensions } from '../stock/marketTokenLayout.js'
import type {
    CertificatePool,
    EighteenXXState,
    StockInstructionStopReason,
    TileRotation
} from '@tabletop/18xx'
import type { GameAction, GameState } from '@tabletop/common'
import type { PhaseChartData } from '../phases/phaseChart.js'
import type { MoneyFormat } from '../presentation/money.js'
import type {
    CompanyNameVariants,
    CompanyPricePresentation,
    NumberedShareNames
} from '../table/companyPresentation.js'
import type { TileSymbolName } from '../tiles/tileSymbols.js'
import type { TerrainIconName } from '../maps/terrainIcons.js'
import type { HistoryMapPlacement } from '../maps/historicalMap.js'

export type PrivateTokenPresentation =
    | { companyId: string }
    | { tileSymbol: TileSymbolName }
    | { terrain: TerrainIconName }
    | { imageUrl: string }
    | { tiles: readonly { definitionId: string; rotation: TileRotation }[] }

export type TitleStopReason = Extract<StockInstructionStopReason, { code: 'title' }>

/** A round of the title's own that follows an operating round and is numbered after it. */
export type TitleRound<State extends GameState = EighteenXXState> = {
    name: string
    abbreviation: string
    inProgress(state: State): boolean
    starts: (action: GameAction) => boolean
    ends: (action: GameAction) => boolean
    /**
     * Whether, held between stock and operating rounds, it takes the stock round's number; held
     * during an operating round it takes that round's.
     */
    followsStockRound?: boolean
}

/** A labelled fact of the title's own, about the game or one of its companies. */
export type TitleFact = { label: string; value: string }
/** A right or marker a company holds, shown beside its trains, such as access to coal fields. */
export type CompanyMark = { label: string; description: string }
/** The companies a company was formed from, shown under its header, such as a System's shells. */
export type CompanyOrigin = { text: string; companyIds: readonly string[] }

/**
 * A label above a market zone, drawn across its spaces as an arrow toward its far end or as a span
 * between its ends.
 */
export type MarketZoneBanner = { label: string; shape: 'arrow' | 'span' }

/** Replaces the tint of a zone's chart colour, which dark mode dims, where the colour carries meaning. */
export type MarketZoneFill = { kind: 'solid'; color: string } | { kind: 'recessed' }

/** The meaning of the market spaces of one colour, for their descriptions and the legend. */
export type MarketZone = {
    color: string
    name: string
    description: string
    banner?: MarketZoneBanner
    fill?: MarketZoneFill
    /** Drawn stacked in each space's lower left, clear of a company stack at the right. */
    marks?: readonly string[]
}

/**
 * A line across the market that stops or diverts movement, such as a soft ledge, drawn along the
 * named side of each space it borders.
 */
export type MarketLedge = {
    name: string
    description: string
    edges: readonly { spaceId: string; side: 'bottom' | 'right' }[]
}

/** A company statistic of the title's own, shown as a sortable spreadsheet column. */
export type CompanyColumn<State extends GameState = EighteenXXState> = {
    id: string
    label: string
    /** What the column sorts by; companies without a value sort last. */
    value(state: State, companyId: string): number | undefined
    text(state: State, companyId: string): string
}

export type TitlePresentation<State extends GameState = EighteenXXState> = {
    money: MoneyFormat
    trainShortLabels?: Readonly<Record<string, string>>
    phaseChart: PhaseChartData
    /** The phase chart for the game's state, where a variant changes the trains or phases. */
    phaseChartFor?(state: State): PhaseChartData
    trainColors: Readonly<Record<string, string>>
    phaseColors: Readonly<Record<string, string>>
    marketPoolId: string
    /** The bank's pool of shares not yet sold, where a title has one. */
    ipoPoolId?: string
    exchangePoolId?: string
    companyNames: Readonly<Record<string, CompanyNameVariants>>
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
    /** Shown under the player's own privates when they have none the company can buy. */
    privatePurchaseEmpty?: string
    privateTilePrompts?: Readonly<Record<string, string>>
    privateTokens?: Readonly<Record<string, PrivateTokenPresentation>>
    /** Lists minor companies a player owns among their privates, as 1846 sells them in its draft. */
    minorsAsPrivates?: true
    operatingSteps?: readonly {
        label: string
        states: readonly string[]
        actions: readonly string[]
        status?(
            state: State,
            actions: readonly GameAction[],
            summaries: OperatingStepStatuses
        ): string | undefined
    }[]
    openingRound?: Pick<TitleRound<State>, 'name' | 'abbreviation' | 'inProgress'>
    titleRounds?: readonly TitleRound<State>[]
    /** Facts of the title's own for the game information, such as money left to subsidise. */
    gameFacts?(state: State): readonly TitleFact[]
    companyColumns?: readonly CompanyColumn<State>[]
    /** Facts of the title's own about a company, such as its size or interest due. */
    companyFacts?(state: State, companyId: string): readonly TitleFact[]
    companyMarks?(state: State, companyId: string): readonly CompanyMark[]
    companyOrigin?(state: State, companyId: string): CompanyOrigin | undefined
    /**
     * What an operating company takes off printed terrain and border costs, by terrain kind, such
     * as a private's mountain discount; the map shows the costs it would pay.
     */
    terrainDiscounts?(state: State, companyId: string): Readonly<Record<string, number>>
    /** Where a title's own actions place on the map, beyond the family's tile lays and stations. */
    historyMapPlacement?(action: GameAction): HistoryMapPlacement | undefined
    marketCell?: MarketCellDimensions
    marketZones?: readonly MarketZone[]
    marketLedge?: MarketLedge
    /** Leaves the zones and ledge out of a legend below the market; each space's tooltip still names its zone. */
    hideMarketLegend?: true
    /**
     * Published card artwork for the published presentation, keyed by private company id or
     * certificate id (for shares auctioned like privates). Shown in place of the generated card.
     */
    publishedCardImages?: Readonly<Record<string, string>>
    /**
     * Published cards shown with a plate below naming what they come with, from the generated
     * card's tokens and opening line, for prints that cannot name a company drawn at setup.
     */
    publishedCardPlates?: readonly string[]
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
    /** Market zones for the published presentation, in place of marketZones. */
    publishedMarketZones?: readonly MarketZone[]
}
