import type { CorporateFinanceTerms } from './corporateFinanceModule.svelte.js'
import type { OperatingStepStatuses } from '../table/operatingStepStatuses.js'
import type { MarketCellDimensions } from '../stock/marketTokenLayout.js'
import type {
    EighteenXXState,
    RailwayMap,
    StockInstructionStopReason,
    TileRotation,
    Train
} from '@tabletop/18xx'
import type { GameAction, GameState } from '@tabletop/common'
import type { PhaseChartData } from '../phases/phaseChart.js'
import type { MoneyFormat } from '../presentation/money.js'
import type { TableTerms } from '../presentation/tableTerms.js'
import type {
    CompanyNameVariants,
    CompanyPricePresentation,
    NumberedShareNames
} from '../table/companyPresentation.js'
import type { TileSymbolName } from '../tiles/tileSymbols.js'
import type { TerrainIconName } from '../maps/terrainIcons.js'
import type { HistoryMapPlacement } from '../maps/historicalMap.js'
import type { LocationMarkerArt } from '../maps/stationPresentation.js'

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

/** A title's own use of a private, offered beside the family's private controls. */
export type TitlePrivateAction = { label: string; pressed: boolean; press(): void }

/** A labelled fact of the title's own, about the game or one of its companies. */
export type TitleFact = {
    label: string
    value: string
    /** Shown on a company card as a line beneath its figures rather than as one of them. */
    below?: true
}
/** How a title names its loans and their actions, and what follows interest a treasury lacks. */
export type LoanTerms = {
    /** The label for a company's loans: "Bond". */
    name: string
    take: string
    repay: string
    /** What happened when the treasury could not pay the interest; liquidation unless given. */
    interestDefault?: string
    /** The rate never changes and every company may borrow, so the game information omits both. */
    fixedTerms?: true
}
/** A right or marker a company holds, shown beside its trains, such as access to coal fields. */
/**
 * A space of a start choice drawn as the board prints it: an option to pick, or held by a
 * company; its label is printed in an open space.
 */
export type StartChoiceSpace = {
    label: string
    description: string
    optionId?: string
    companyId?: string
}
/**
 * A rule in force for a while, announced under the phase strip, such as 1880's Communist
 * Takeover: its banner's label, and the dialog it opens with its rules.
 */
export type PhaseNotice = {
    label: string
    title: string
    summary?: string
    rules: readonly string[]
}
/** An image on a company card's token, with words for what it means. */
export type TokenBadge = { imageUrl: string; description: string }
/**
 * A mark beside a company's name; one with an image, such as a ferry it owns, shows the image. A
 * `compact` mark is a small symbol: it follows the company's name, or sits under the company's
 * token on the narrow card, in place of standing beside its trains.
 */
export type CompanyMark = {
    label: string
    description: string
    imageUrl?: string
    compact?: true
}
/**
 * Tokens a train carries, such as warranties, drawn as pips under its badge. A train that only
 * its tokens keep from rusting is `lapsing`, and its badge is striped.
 */
export type TrainTokens = { count: number; lapsing: boolean; description: string }
export type PlaceConnection = { from: string; to: string }

/** Shown under a company's header: the companies it was formed from, such as a System's shells, or a connection it can show on the map. */
export type CompanyOrigin =
    { text: string; companyIds: readonly string[] } | { text: string; connection: PlaceConnection }

/**
 * A label above a market zone, drawn across its spaces as an arrow toward its far end or as a span
 * between its ends.
 */
export type MarketZoneBanner = { label: string; shape: 'arrow' | 'span' }

/**
 * Replaces the tint of a zone's chart colour, which dark mode dims, where the colour carries meaning.
 * A solid fill dark enough to need light text names its ``ink``.
 */
export type MarketZoneFill = { kind: 'solid'; color: string; ink?: string } | { kind: 'recessed' }

/** The meaning of the market spaces of one colour, for their descriptions and the legend. */
export type MarketZone = {
    color: string
    name: string
    description: string
    banner?: MarketZoneBanner
    fill?: MarketZoneFill
    /** Drawn stacked in each space's lower left, clear of a company stack at the right. */
    marks?: readonly string[]
    /** Printed sideways down the left of each of the zone's spaces, below its price. */
    label?: string
    /** Drawn as one group, a little apart from the spaces on either side of it. */
    setApart?: true
    /**
     * Colours the value on a company's card while its price stands in the zone, for zones whose
     * rules apply to the company there, such as freedom from the certificate limit.
     */
    marksCompanyValue?: true
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

/** What the companies tab shows of companies no one has started. */
export type UnstartedCompanies<State extends GameState = EighteenXXState> = {
    /** Whether the company could be started in this phase. */
    onOffer(state: State, companyId: string): boolean
    /** Its home cities, or that its president chooses one as it starts. */
    home(state: State, companyId: string): UnstartedCompanyHome
}
export type UnstartedCompanyHome = { locationIds: readonly string[] } | 'chosen'
/** Every company no one has started, at the homes the map prints for it. */
export function printedHomeCompanies<State extends GameState = EighteenXXState>(
    map: RailwayMap
): UnstartedCompanies<State> {
    return {
        onOffer: () => true,
        home: (_state, companyId) => ({ locationIds: map.reservedLocationIds(companyId) })
    }
}

/** A company statistic of the title's own, shown as a spreadsheet column. */
export type CompanyColumn<State extends GameState = EighteenXXState> = {
    id: string
    label: string
    /** What the column sorts by; companies without a value sort last. A column without it does not sort. */
    value?(state: State, companyId: string): number | undefined
    text(state: State, companyId: string): string
    /** Marks drawn in place of the text, such as the permits a company holds. */
    marks?(state: State, companyId: string): readonly CompanyMark[]
    /** Placed before the last run rather than after it, as 1880's permits. */
    beforeLastRun?: true
}

/** A step of the operating turn as the step bar shows it, with the states and Actions it covers. */
export type TitleOperatingStep<State extends GameState = EighteenXXState> = {
    label: string
    states: readonly string[]
    actions: readonly string[]
    status?(
        state: State,
        actions: readonly GameAction[],
        summaries: OperatingStepStatuses
    ): string | undefined
}

/** How a drawn run is held to the best routes found. */
export type DrawnRunStandard = 'always' | 'unless-subsidy-rises'

export type TitlePresentation<State extends GameState = EighteenXXState> = {
    money: MoneyFormat
    phaseChart: PhaseChartData
    /** The phase chart for the game's state, where a variant changes the trains or phases. */
    phaseChartFor?(state: State): PhaseChartData
    trainColors: Readonly<Record<string, string>>
    phaseColors: Readonly<Record<string, string>>
    marketPoolId: string
    /** The bank's pool of shares not yet sold, where a title has one. */
    ipoPoolId?: string
    exchangePoolId?: string
    /** The rulebook's words for what the table names, where they are not the family's. */
    terms?: Partial<TableTerms>
    companyNames: Readonly<Record<string, CompanyNameVariants>>
    companyPricePresentation?: CompanyPricePresentation
    numberedShareNames?: NumberedShareNames
    includedCompanyIds?: readonly string[]
    mapFocusExcludedCompanyIds?: readonly string[]
    portfolioCompanyIds?: readonly string[]
    includedPortfolioCompanyIds?: readonly string[]
    poolName?: (poolId: string) => string
    instructionStopText?: (reason: TitleStopReason) => string
    /**
     * What a run pays the treasury beside its revenue is called, as 1822's mail income; "subsidy
     * to the treasury" where the title names nothing.
     */
    runSubsidyName?: string
    /** What the revenue a company may decide apart from the rest is called, as 1822's permanent train's. */
    separateEarningsName?: string
    privatePurchaseLabel?: string
    privatePurchaseHeading?: string
    /** Shown under the player's own privates when they have none the company can buy. */
    privatePurchaseEmpty?: string
    privateTilePrompts?: Readonly<Record<string, string>>
    privateTokens?: Readonly<Record<string, PrivateTokenPresentation>>
    /** Lists minor companies a player owns among their privates, as 1846 sells them in its draft. */
    minorsAsPrivates?: true
    operatingSteps?: readonly TitleOperatingStep<State>[]
    corporateFinance?: CorporateFinanceTerms
    /** Words for a title's loans where it calls them something else, as 1849's bonds. */
    loanTerms?: LoanTerms
    /**
     * A mark beside whoever holds an ordinary certificate of more than one share, as 1849 marks
     * its two-share last certificate, wherever holdings are listed.
     */
    multiShareCertificate?: { label: string; name: string; description: string }
    /**
     * The words for an insolvent company's end, where train funding closes it rather than
     * bankrupting its president: an explanation and a button label for each choice offered.
     */
    insolvency?: {
        explanation: string
        /** Where a company's debt its president cannot raise fails it, rather than a train. */
        debtExplanation?: string
        choices: Readonly<Record<string, { label: string; description: string }>>
    }
    openingRound?: Pick<TitleRound<State>, 'name' | 'abbreviation' | 'inProgress'>
    titleRounds?: readonly TitleRound<State>[]
    /** Facts of the title's own for the game information, such as money left to subsidise. */
    gameFacts?(state: State): readonly TitleFact[]
    /** A rule in force announced under the game information, such as 1880's communism. */
    phaseNotice?(state: State): PhaseNotice | undefined
    /**
     * Marker art that changes with play, by location id then marker id, over the map view's:
     * such as a marker hidden once its rule lapses, or one a private has marked.
     */
    markerArtFor?(state: State): LocationMarkerArt
    /** The off-board captions a game's variants print, in place of the map view's. */
    revenueStageCaptionsFor?(state: State): Readonly<Record<string, string>> | undefined
    companyColumns?: readonly CompanyColumn<State>[]
    /**
     * Lines of the title's own under a company's start, beside its home, such as a fee its
     * treasury pays as it starts.
     */
    startNotes?(state: State, companyId: string): readonly string[]
    /** Facts of the title's own about a player, such as a loan they owe, shown beside their cash. */
    playerFacts?(state: State, playerId: string): readonly TitleFact[]
    /**
     * The companies tab's switch to show companies no one has started beside the started ones,
     * for titles where players weigh what is still to come; no switch unless given.
     */
    unstartedCompanies?: UnstartedCompanies<State>
    /** Facts of the title's own about a company, such as its size or interest due. */
    companyFacts?(state: State, companyId: string): readonly TitleFact[]
    companyMarks?(state: State, companyId: string): readonly CompanyMark[]
    /**
     * What a company card's privates section lists in place of the privates the company owns,
     * under its own heading, such as 1880's powers its director's privates give it (§VI); their
     * income, the director's, is left off.
     */
    companyPowers?: {
        heading: string
        privateIds(state: State, companyId: string): readonly string[]
    }
    /**
     * Small images on the lower right of a company card's token, such as the flag of a 1880
     * foreign investor that will join the company (§VII).
     */
    companyTokenBadges?(state: State, companyId: string): readonly TokenBadge[]
    /** The tokens on a company's train. A title that draws them gives every train's, so badges line up at the top. */
    trainTokens?(state: State, train: Train): TrainTokens
    /**
     * Whether a company's president's mark gives the size of the president's certificate in
     * shares, as P3, where the president chooses it, as for 1880's majors (§XII).
     */
    presidentMarkShowsShares?(state: State, companyId: string): boolean
    /**
     * Draws a start choice as a row of spaces, such as 1880's par slots on its operating order
     * list (§XII), held ones showing their company; undefined draws the choice as buttons.
     */
    startChoiceSpaces?(
        state: State,
        choiceId: string,
        marketSpaceId: string
    ): readonly StartChoiceSpace[] | undefined
    /** The action panel names companies, privates aside, by their initials, as 1880's JLR. */
    actionCompanyInitials?: true
    /** Player cards leave out their privates' value, where privates are worth nothing, as 1880's (§XV). */
    privatesWithoutValue?: true
    /**
     * Whether building shows a projected run for this company, for a title where a company's run
     * does not follow from its network, as 1828's C&P pays only for a run through its new tile.
     */
    projectsRun?(companyId: string): boolean
    /** A word for an open private's state in place of its income, such as Flipped. */
    privateStatus?(state: State, privateCompanyId: string): string | undefined
    /**
     * What a private company keeps on its own charter for the player who holds it, said under
     * its name on that player's card, as 1822's tax haven holds shares and money.
     */
    privateHoldings?(state: State, privateCompanyId: string): string | undefined
    companyOrigin?(state: State, companyId: string): CompanyOrigin | undefined
    /**
     * What an operating company takes off printed terrain and border costs, by terrain kind, such
     * as a private's mountain discount; the map shows the costs it would pay.
     */
    terrainDiscounts?(state: State, companyId: string): Readonly<Record<string, number>>
    /**
     * Whether an operating company's director may change its run by drawing routes on the map,
     * where the title's rules let a director run for less than the most; it otherwise runs the
     * best routes found.
     */
    manualRoutes?(state: State, companyId: string): boolean
    /** What Autorun does for a company whose turn is not the family's run and payout. */
    autorunDescription?(companyId: string): string | undefined
    /**
     * A drawn run must earn as much as the best routes found, where the title lets a director
     * choose among the best runs but not run for less (1822 §5.13.6). With
     * ``unless-subsidy-rises`` a run that earns less may still run where it pays the treasury a
     * higher subsidy than the best found, as a run reduced for mail income does.
     */
    drawnRunsEarnMost?: DrawnRunStandard
    /** Where a title's own actions place on the map, beyond the family's tile lays and stations. */
    historyMapPlacement?(action: GameAction): HistoryMapPlacement | undefined
    marketCell?: MarketCellDimensions
    marketZones?: readonly MarketZone[]
    marketLedge?: MarketLedge
    /** Leaves the zones and ledge out of a legend below the market; each space's tooltip still names its zone. */
    hideMarketLegend?: true
    /**
     * Whether player cards show the most each player may bid for a company, where a bid may
     * count more than cash, as 1817's privates count toward it.
     */
    biddingPowerShown?(state: State): boolean
    /** Leaves the cost off a company's remaining station tokens, when stations are paid for another way, such as at flotation. */
    hideStationCosts?: true
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
