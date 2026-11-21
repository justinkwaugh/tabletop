export { default as Tile } from './tiles/Tile.svelte'
export { default as TileArtwork } from './tiles/TileArtwork.svelte'
export { default as TileLibraryViewer } from './tiles/TileLibraryViewer.svelte'
export { default as TileManifest } from './tiles/TileManifest.svelte'
export {
    TileApothem,
    TileRadius,
    createTileDrawing,
    type TileDrawing,
    type TileDrawnPath,
    type TilePrintedToken,
    type TilePrintedTrack,
    type TilePrintedShape,
    type TilePrintedText,
    type TileDrawnNode,
    type TileDrawingStyle,
    type TileLayout
} from './tiles/tileDrawing.js'
export { TileColors } from './tiles/tilePresentation.js'
export {
    StandardTileLayouts,
    placedTileLayout,
    towardTileEdge
} from './tiles/standardTileLayouts.js'
export * from './maps/mapDrawing.js'
export * from './maps/printedLinePath.js'
export * from './maps/companyMark.js'
export { default as MapScene } from './maps/MapScene.svelte'
export { default as MapInspector } from './maps/MapInspector.svelte'
export {
    ClassicTileAppearance,
    MutedTileAppearance,
    MakerTileAppearance,
    CustomTileAppearance,
    TileAppearances,
    tileDrawingStyle,
    type TileAppearance
} from './tiles/tileAppearance.js'
export { revenueBadgeHalfWidth } from './tiles/revenueBadge.js'
export { default as Portfolio } from './finance/Portfolio.svelte'
export { default as FinanceInspector } from './finance/FinanceInspector.svelte'
export { default as PresidentBadge } from './finance/PresidentBadge.svelte'
export { ownerPortfolio } from './finance/ownerPortfolio.js'
export { withDraftedCompanies, type DraftedCompany } from './finance/draftedCompanies.js'

export * from './session/eighteenXXSession.svelte.js'
export { StagedSelection, singleChoice } from './session/stagedSelection.svelte.js'
export type { PrivateTrackPower, TitlePrivatePower } from './session/privateActionsModule.svelte.js'
export type { TitleTrackConstruction, TitleTrackLay } from './session/trackModule.svelte.js'
export { default as StockTrading } from './stock/StockTrading.svelte'
export { default as StockMarket } from './stock/StockMarket.svelte'

export * from './maps/stationPresentation.js'
export type { BonusArrowFooter, MapBonusArrow } from './maps/bonusArrows.js'
export { contrastingTextColor } from './colors/contrastingTextColor.js'
export type { RevenueStageColor, RevenueStageColors } from './colors/revenueStageColors.js'
export { default as MapViewer } from './maps/MapViewer.svelte'
export { default as FinanceMap } from './maps/FinanceMap.svelte'

export { default as TrainBuying } from './trains/TrainBuying.svelte'

export { default as PrivateCompanies } from './privates/PrivateCompanies.svelte'
export { setPlaceLinks, type PlaceLinks } from './places/placeLinks.js'
export { default as PlaceText } from './places/PlaceText.svelte'

export { default as CompanyDecisions } from './finance/CompanyDecisions.svelte'
export { default as DecisionResponse } from './finance/DecisionResponse.svelte'
export { default as WaterfallAuctionPanel } from './auctions/WaterfallAuctionPanel.svelte'

export type { AuctionSelection } from './auctions/auctionSelection.js'

export { default as OfferAuctionPanel } from './auctions/OfferAuctionPanel.svelte'

export { default as GameEnding } from './ending/GameEnding.svelte'

export { default as GameTable } from './table/GameTable.svelte'
export { companiesOnOffer } from './table/spreadsheetCompanies.js'
export {
    companyNameVariants,
    DefaultCompanyPricePresentation,
    NoParCompanyPricePresentation,
    shortCompanyName,
    type CompanyNameVariants,
    type CompanyNaming,
    type NumberedShareNames
} from './table/companyPresentation.js'
export type {
    HistoryDescription,
    HistoryNames,
    TitleActionDescription,
    TitleHistoryNames
} from './table/historyDescription.js'
export type { TitleCallout } from './table/historyCallouts.js'
export {
    companyClosedRow,
    companyClosureDetails,
    declinedTrainsWords,
    stopRightsBoughtRow,
    departurePaymentsDetail,
    joinDetails,
    ownerName
} from './table/historyDescription.js'
export { trainCount, type AwaitedDecision, type DecisionNames } from './table/awaitedDecision.js'
export type {
    CompanyColumn,
    CompanyMark,
    StartChoiceSpace,
    PhaseNotice,
    TokenBadge,
    TrainTokens,
    MarketLedge,
    MarketMarker,
    MarketZone,
    MarketZoneBanner,
    MarketZoneFill,
    PlaceConnection,
    PrivateTokenPresentation,
    TitleFact,
    TitlePrivateAction,
    LoanTerms,
    TitleOperatingStep,
    TitlePresentation,
    TitleRound,
    UnstartedCompanies,
    UnstartedCompanyHome
} from './session/titlePresentation.js'
export { printedHomeCompanies } from './session/titlePresentation.js'
export { constructionOperatingSteps } from './table/operatingStep.js'
export type { TileSymbolName } from './tiles/tileSymbols.js'
export { tileSymbolMarkup } from './tiles/tileSymbols.js'
export { counted } from './presentation/count.js'
export { InstructedRunSolver } from './session/instructedRunSolver.js'
export { currencyAffixes, moneyFormat, type MoneyFormat } from './presentation/money.js'
export {
    DefaultTableTerms,
    tableTerms,
    type ResolvedTableTerms,
    type TableTerms
} from './presentation/tableTerms.js'
export { clickedBackdrop } from './presentation/modalDialog.js'
export { svgDataUrl } from './presentation/svgDataUrl.js'
export { default as OperatingActions } from './table/OperatingActions.svelte'
export { default as OperatingModeSwitch } from './table/OperatingModeSwitch.svelte'
export { default as ConstructionPrompt } from './table/ConstructionPrompt.svelte'
export { default as CorporateFinance } from './finance/CorporateFinance.svelte'
export { default as NothingToBuild } from './maps/NothingToBuild.svelte'
export { default as PresidencyClaims } from './stock/PresidencyClaims.svelte'
export {
    CorporateFinanceModule,
    type CorporateFinanceHoldings,
    type CorporateFinanceTerms,
    type CorporateFinanceSession
} from './session/corporateFinanceModule.svelte.js'
export {
    OperatingModeModule,
    type OperatingMode,
    type OperatingModeOption,
    type ModeLabel,
    type OperatingModeSession,
    type TitleOperatingMode
} from './session/operatingModeModule.svelte.js'
export {
    PresidencyClaimModule,
    type PresidencyClaimSession
} from './session/presidencyClaimModule.svelte.js'

export { default as StockMarketScene } from './stock/StockMarketScene.svelte'

export { default as CompanyToken } from './tokens/CompanyToken.svelte'
export { default as SlidingToggle } from './table/SlidingToggle.svelte'
export { default as SwitchTrack } from './table/SwitchTrack.svelte'
export { default as CompanyOrder } from './table/CompanyOrder.svelte'

export { default as CompanyDetails } from './table/CompanyDetails.svelte'

export { default as TrainBadge } from './trains/TrainBadge.svelte'
export { default as TrainTokenPips } from './trains/TrainTokenPips.svelte'

export { default as AuctionOffers } from './auctions/AuctionOffers.svelte'

export { default as AuctionBidControl } from './auctions/AuctionBidControl.svelte'
export { default as BidBoxes, type BidBoxGroup } from './auctions/BidBoxes.svelte'
export { BidBoxModule, type BidBoxLot, type BidBoxSession } from './session/bidBoxModule.svelte.js'
export { default as OfferAuctionBidding } from './auctions/OfferAuctionBidding.svelte'
export { default as WaterfallAuctionLots } from './auctions/WaterfallAuctionLots.svelte'
export { default as SelectionAuctionLots } from './auctions/SelectionAuctionLots.svelte'
export { default as SelectionAuctionBidding } from './auctions/SelectionAuctionBidding.svelte'
export { default as CompanyAuctionBidding } from './stock/CompanyAuctionBidding.svelte'
export { default as CompanyFormation } from './stock/CompanyFormation.svelte'
export { default as CompanyPar } from './stock/CompanyPar.svelte'
export { default as PresidencyExchangeChoice } from './stock/PresidencyExchangeChoice.svelte'
export { exchangeChoiceWords, type ExchangeCertificate } from './stock/presidencyExchangeWords.js'
export { default as CompanyActionCard, type CardAction } from './stock/CompanyActionCard.svelte'
export { default as CompanyShareActions } from './stock/CompanyShareActions.svelte'
export { default as PendingShareDecision } from './stock/PendingShareDecision.svelte'
export {
    ShareActions,
    redemptionHolderName,
    type CompanyShareOptions,
    type ShareActionNames
} from './stock/shareActions.svelte.js'
export { describeShareAction } from './stock/shareActionHistory.js'
export { default as StockPanelHeading } from './stock/StockPanelHeading.svelte'
export { default as CompanyActionPanel } from './stock/CompanyActionPanel.svelte'

export { default as PrivateCard } from './privates/PrivateCard.svelte'
export {
    createDieselPhaseChart,
    createPhaseChart,
    type PhaseChartData,
    type TrainMark,
    type TrainUpgrade
} from './phases/phaseChart.js'

export * from './stock/marketAnimationSource.js'

export { marketColors, marketSpaceColor, marketZone } from './stock/marketColors.js'
export {
    MarketScenePadding,
    MarketTokenSize,
    MarketZoneBannerHeight,
    MarketTabHeight,
    marketGeometry
} from './stock/marketTokenLayout.js'

export { LoanRateTableHeight } from './loans/loanRateTable.js'
export { default as PlayerLoanRepayment } from './loans/PlayerLoanRepayment.svelte'
export { operatingRoundInProgress } from './table/roundHeading.js'

export { default as BoardInset } from './maps/BoardInset.svelte'

export { RoutesModule, type RoutesSession } from './session/routesModule.svelte.js'
export { RouteEditor } from './session/routeEditor.svelte.js'
export { TitleStockPanels, type TitleStockPanel } from './session/titleStockPanels.svelte.js'
export { StopRightsActions } from './session/stopRightsActions.svelte.js'
export { default as TitlePrompt } from './table/TitlePrompt.svelte'
export { default as ShareTitleActions } from './table/ShareTitleActions.svelte'
export { default as RouteBuilding } from './routes/RouteBuilding.svelte'
export { runForHistoryStep } from './routes/runForHistoryStep.js'

export { earningsForHistoryStep } from './earnings/earningsForHistoryStep.js'
export { actionForHistoryStep } from './table/actionForHistoryStep.js'

export { default as AutomaticRoutes } from './routes/AutomaticRoutes.svelte'
export { default as ProjectedRun } from './routes/ProjectedRun.svelte'
export { default as TrainRunTable } from './routes/TrainRunTable.svelte'
export { routeColor } from './routes/routePresentation.js'
export { default as RunInstructions } from './routes/RunInstructions.svelte'
export { RouteSolveQueue, type QueuedRouteWorker } from './routes/routeSolveQueue.js'
export { default as StationBuilding } from './maps/StationBuilding.svelte'
export type { HistoricalMapState, HistoryMapPlacement } from './maps/historicalMap.js'
export {
    MergerRoundModule,
    type MergerDraft,
    type MergerRoundSession
} from './session/mergerRoundModule.svelte.js'
export {
    TrainlessMajorModule,
    type TrainlessMajorSession
} from './session/trainlessMajorModule.svelte.js'
export { NationalRailwaySession } from './session/nationalRailwaySession.svelte.js'
export { default as MergerRound } from './mergers/MergerRound.svelte'
export { default as TrainlessMajor } from './mergers/TrainlessMajor.svelte'
export {
    describeNationalRailwayAction,
    type NationalRailwayNames
} from './mergers/nationalRailwayHistory.js'
