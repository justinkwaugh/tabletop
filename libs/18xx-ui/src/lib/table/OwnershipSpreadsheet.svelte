<script lang="ts">
    import { untrack } from 'svelte'
    import { holdsReceiverPresidentCertificate } from '../finance/companyOwnership.js'
    import { multiShareMark, type MultiShareMark } from '../finance/multiShareCertificates.js'
    import { chainSidewaysScroll } from '@tabletop/frontend-components'
    import CertificateCount from '../stock/CertificateCount.svelte'
    import { cashText, optionalMoney } from '../presentation/money.js'
    import './playerTint.css'
    import '../stock/tradePopover.css'
    import {
        companyMarketSpace,
        DefaultCompanyPricePresentation,
        shownParPrice,
        type CompanyPricePresentation
    } from './companyPresentation.js'
    import { assert, assertExists, type GameAction } from '@tabletop/common'
    import { companyLastRun } from './companyLastRun.js'
    import {
        cashOwnedBy,
        actingOperatingCompany,
        certificatesInPool,
        signedShares,
        controllingOwner,
        getCompany,
        presidentOf,
        sameOwner,
        playersWithBankruptLast,
        sharesOwned,
        trainsOwnedBy,
        type Company,
        type Station,
        type Owner,
        type PurchaseRequest,
        isObsoleteTrain,
        stationPlacer
    } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import type { NumberedShareNames } from './companyPresentation.js'
    import PlayerName from './PlayerName.svelte'
    import IncomeHistory from './IncomeHistory.svelte'
    import { spreadsheetCompanies } from './spreadsheetCompanies.js'
    import {
        spreadsheetPrivates,
        type PrivateHolderSide,
        type SpreadsheetPrivateHolder
    } from './spreadsheetPrivates.js'
    import { marketValueMark } from '../stock/marketColors.js'
    import '../stock/marketZoneTint.css'
    import { numberedSharesOwned } from './numberedShares.js'
    import SpreadsheetOutline from './SpreadsheetOutline.svelte'
    import { playerPurchaseContribution } from '../stock/purchaseContribution.js'
    import {
        nextSpreadsheetSort,
        orderedAs,
        seatOrderFrom,
        sortedForSpreadsheet,
        spreadsheetSortDirection,
        type SpreadsheetSort,
        type SpreadsheetSortColumn,
        type SpreadsheetSortDirection
    } from './spreadsheetSort.js'

    import CompanyToken from '../tokens/CompanyToken.svelte'
    import TrainBadge from '../trains/TrainBadge.svelte'

    let {
        session,
        pricePresentation = DefaultCompanyPricePresentation,
        fillWidth = false,
        onPreviewMap,
        companyOrder,
        marketPoolId,
        ipoPoolId,
        exchangePoolId,
        trainColors,
        numberedShareNames = {},
        includedCompanyIds = [],
        includedPortfolioCompanyIds = [],
        portfolioCompanyIds = []
    }: {
        pricePresentation?: CompanyPricePresentation
        fillWidth?: boolean
        companyOrder?: readonly string[]
        onPreviewMap: (action: GameAction) => void
        session: EighteenXXSessionView
        marketPoolId: string
        ipoPoolId?: string
        exchangePoolId?: string
        trainColors: Readonly<Record<string, string>>
        numberedShareNames?: NumberedShareNames
        includedCompanyIds?: readonly string[]
        portfolioCompanyIds?: readonly string[]
        includedPortfolioCompanyIds?: readonly string[]
    } = $props()
    type PendingShareTrade =
        | { kind: 'buy'; request: PurchaseRequest }
        | { kind: 'sell'; companyId: string; ownerId: string }
    const money = $derived(session.presentation.money)
    let shareConfirmation = $state<HTMLDivElement>()
    let pendingTrade = $state<PendingShareTrade>()
    let confirmationPosition = $state({ top: 0, left: 0 })
    const tradingDisabled = $derived(
        session.busy ||
            session.updatingVisibleState ||
            session.isViewingHistory ||
            !session.myPlayer ||
            !session.gameState.activePlayerIds.includes(session.myPlayer.id)
    )
    const availablePurchases = $derived(
        tradingDisabled
            ? []
            : session.stock.purchaseChoices.filter((choice) => choice.result.details)
    )
    const availableSales = $derived(
        tradingDisabled ? [] : session.stock.saleChoices.filter((choice) => choice.result.details)
    )
    const pendingPurchaseChoices = $derived.by(() => {
        const trade = pendingTrade
        return trade?.kind === 'buy'
            ? availablePurchases.filter(
                  (choice) => choice.request.certificateId === trade.request.certificateId
              )
            : []
    })
    const pendingPlayerPurchase = $derived(
        pendingPurchaseChoices.find((choice) => choice.request.buyer.kind === 'player')
    )
    const pendingPurchaseChoice = $derived(pendingPlayerPurchase ?? pendingPurchaseChoices[0])
    const pendingCompanyPurchases = $derived(
        pendingPurchaseChoices.filter((choice) => choice.request.buyer.kind === 'company')
    )
    const pendingSaleChoices = $derived(
        pendingTrade?.kind === 'sell'
            ? saleChoicesForCell(pendingTrade.companyId, pendingTrade.ownerId)
            : []
    )
    const operatingCompanyId = $derived(
        session.gameState.stockRound.completed &&
            session.gameState.operatingSet &&
            !session.gameState.result
            ? actingOperatingCompany(session.gameState)
            : undefined
    )
    const currentPlayerOwners = $derived(
        new Set(
            operatingCompanyId ? [] : session.gameState.activePlayerIds.map((id) => `player:${id}`)
        )
    )
    const companies = $derived(
        spreadsheetCompanies(
            session.gameState,
            session.charters,
            session.actions,
            session.gameState.actionCount,
            companyOrder,
            includedCompanyIds
        )
    )
    const periods = ['Current', 'Player income', 'Company payouts'] as const
    let period = $state<(typeof periods)[number]>('Current')
    $effect(() => {
        if (
            period !== 'Current' ||
            (pendingTrade?.kind === 'buy' && !pendingPurchaseChoice) ||
            (pendingTrade?.kind === 'sell' && !pendingSaleChoices.length)
        )
            shareConfirmation?.hidePopover()
    })
    let scrolled = $state(false)
    const maxPinnedLabelShare = 0.35
    let scrollViewportWidth = $state(0)
    let labelColumnWidth = $state(0)
    const pinLabelColumn = $derived(labelColumnWidth <= scrollViewportWidth * maxPinnedLabelShare)
    const view = $derived(
        session.preferences.values.spreadsheetView === 'company' ? 'Company' : 'Player'
    )
    function soldThisRound(ownerId: string, companyId: string): boolean {
        const gameState = session.gameState
        return (
            gameState.machineState === 'StockRound' &&
            !gameState.stockRound.completed &&
            gameState.stockRound.sales.some(
                (sale) => sale.companyId === companyId && ownerIdFor(sale.owner) === ownerId
            )
        )
    }
    function ownerIdFor(owner: Owner): string {
        return owner.kind === 'player'
            ? `player:${owner.playerId}`
            : owner.kind === 'company'
              ? `company:${owner.companyId}`
              : 'bank'
    }
    const firstPoolId = $derived(ipoPoolId ? 'ipo' : 'market')
    const poolColumnLabels: Readonly<Record<string, string>> = $derived({
        ipo: 'IPO',
        market: session.terms.marketPool,
        treasury: 'Treas.',
        exchange: 'Exch.'
    })
    const portfolioColumnLabels = $derived(
        new Map(portfolioCompanyIds.map((id) => [`company:${id}`, session.companyInitials(id)]))
    )
    /** Where a column's certificates are held: its owner, and for the bank, the pool. */
    type CertificateHolder = { owner: Owner; poolId?: string }
    /** The title's mark where the column's owner holds a certificate of several shares. */
    function markedCertificate(companyId: string, ownerId: string): MultiShareMark | undefined {
        const holder = owners.find((owner) => owner.id === ownerId)?.holder(companyId)
        return holder
            ? multiShareMark(
                  session.presentation,
                  session.gameState,
                  companyId,
                  holder.owner,
                  holder.poolId
              )
            : undefined
    }
    // A pool's shorts, such as the market's, count against its shares.
    function poolShares(poolId: string, companyId: string): number {
        return certificatesInPool(session.gameState, poolId).reduce(
            (sum, certificate) =>
                sum + (certificate.companyId === companyId ? signedShares(certificate) : 0),
            0
        )
    }
    function playerShareNumbers(ownerId: string, companyId: string): number[] {
        if (!numberedShareNames[companyId] || !ownerId.startsWith('player:')) return []
        return numberedSharesOwned(
            session.gameState,
            { kind: 'player', playerId: ownerId.slice(7) },
            companyId
        )
    }
    type PurchaseCertificate = (typeof availablePurchases)[number]['certificate']
    const inPool = (poolId: string) => (certificate: PurchaseCertificate) =>
        certificate.poolId === poolId
    function purchaseForCell(companyId: string, ownerId: string) {
        const owner = owners.find((candidate) => candidate.id === ownerId)
        const sells = owner && 'sells' in owner ? owner.sells : undefined
        return sells
            ? availablePurchases.find(
                  (choice) =>
                      choice.certificate.companyId === companyId && sells(choice.certificate)
              )
            : undefined
    }
    function saleChoicesForCell(companyId: string, ownerId: string) {
        return availableSales.filter(
            (choice) =>
                choice.sale.companyId === companyId && ownerIdFor(choice.request.seller) === ownerId
        )
    }
    function openShareConfirmation(event: MouseEvent, trade: PendingShareTrade) {
        const target = event.currentTarget
        assert(target instanceof HTMLElement, 'A share trade requires a source cell')
        const bounds = target.getBoundingClientRect()
        pendingTrade = trade
        confirmationPosition = {
            top:
                bounds.bottom + 160 < window.innerHeight
                    ? bounds.bottom + 6
                    : Math.max(8, bounds.top - 160),
            left: Math.max(116, Math.min(bounds.left + bounds.width / 2, window.innerWidth - 116))
        }
        shareConfirmation?.showPopover()
    }
    function confirmBuy(buyer: Owner) {
        const choice = pendingPurchaseChoices.find((option) =>
            sameOwner(option.request.buyer, buyer)
        )
        assertExists(choice, 'Choose an available share purchase')
        shareConfirmation?.hidePopover()
        void session.stock.buyAndReopenMenu(choice.request)
    }
    function confirmSale(shares: number) {
        const choice = pendingSaleChoices.find((option) => option.sale.shares === shares)
        assertExists(choice, 'Choose an available share sale')
        shareConfirmation?.hidePopover()
        void session.stock.sellAndReopenMenu(choice.request)
    }
    const portfolioOwners = $derived(
        portfolioCompanyIds.map((ownerId) => ({
            id: `company:${ownerId}`,
            name: session.companyName(ownerId),
            controllerId: controllingOwner(session.gameState, ownerId)?.playerId,
            count: (companyId: string) =>
                sharesOwned(session.gameState, companyId, {
                    kind: 'company',
                    companyId: ownerId
                }),
            holder: (): CertificateHolder => ({ owner: { kind: 'company', companyId: ownerId } })
        }))
    )
    const seatOrder = $derived(
        seatOrderFrom(
            session.gameState.players.map((player) => player.playerId),
            session.myPrimaryPlayer?.id
        )
    )
    type OwnerStatistics = {
        turnOrder?: number
        passOrder?: number
        cash: number
        /** The cash a player's bids hold back, shown under it. */
        reserved?: number
        shares: number
        netWorth: number
        certs?: { count: number; limit: number }
    }
    function ownerStatisticsFor(owner: Owner, certs?: OwnerStatistics['certs']): OwnerStatistics {
        const { cash, netWorth, shares } = session.portfolio(owner)
        const reserved = owner.kind === 'player' ? session.reservedCash(owner.playerId) : 0
        return { cash, ...(reserved ? { reserved } : {}), shares, netWorth, certs }
    }
    function firstSortDirection(column: SpreadsheetSortColumn<never>): SpreadsheetSortDirection {
        const first = nextSpreadsheetSort(undefined, 'column', column.directions)
        assertExists(first, 'A sortable column needs a sort direction')
        return first.direction
    }
    const passOrderShown = $derived(session.passing === 'pass-order')
    const OwnerStatisticKeys = ['passOrder', 'cash', 'shares', 'certs', 'netWorth'] as const
    type OwnerStatistic = (typeof OwnerStatisticKeys)[number]
    const ownerStatisticKeys: readonly OwnerStatistic[] = $derived(
        OwnerStatisticKeys.filter(
            (key) =>
                (key !== 'certs' || !session.noCertificateLimit) &&
                (key !== 'passOrder' || passOrderShown)
        )
    )
    type OwnerStatisticColumn = SpreadsheetSortColumn<OwnerStatistics> & {
        label: string
        ariaLabel?: string
        text: (values: OwnerStatistics) => string
    }
    const ownerStatisticColumns: Record<OwnerStatistic, OwnerStatisticColumn> = {
        passOrder: {
            label: 'Pass',
            ariaLabel: 'Pass order',
            value: (values) => values.passOrder,
            text: (values) => (values.passOrder === undefined ? '' : String(values.passOrder)),
            directions: ['ascending', 'descending']
        },
        cash: {
            label: 'Cash',
            value: (values) => values.cash,
            text: (values) => money(values.cash)
        },
        shares: {
            label: 'Shares',
            value: (values) => values.shares,
            text: (values) => String(values.shares)
        },
        certs: {
            label: 'Certs',
            value: (values) => values.certs?.count,
            text: (values) => (values.certs ? `${values.certs.count}/${values.certs.limit}` : '—')
        },
        netWorth: {
            label: 'Net worth',
            value: (values) => values.netWorth,
            text: (values) => money(values.netWorth)
        }
    }
    type PlayerSortKey = OwnerStatistic | 'turnOrder'
    const playerSortColumns: Record<PlayerSortKey, SpreadsheetSortColumn<OwnerStatistics>> = {
        ...ownerStatisticColumns,
        turnOrder: { value: (values) => values.turnOrder, directions: ['ascending'] }
    }
    type CompanyStatistic = 'value' | 'cash' | 'loans' | 'lastRun' | `column:${string}`
    const titleColumns = $derived(session.presentation.companyColumns ?? [])
    const earlyTitleColumns = $derived(titleColumns.filter((column) => column.beforeLastRun))
    const lateTitleColumns = $derived(titleColumns.filter((column) => !column.beforeLastRun))
    /** The heading of the loans a company holds, where the title has them in this game. */
    const loansLabel = $derived(
        session.loans.rules ? (session.presentation.loanTerms?.name ?? 'Loans') : undefined
    )
    const companyStatisticHeadings = $derived([
        pricePresentation.label,
        'Cash',
        'Trains',
        session.terms.stationTokensHeading,
        ...(loansLabel ? [loansLabel] : []),
        ...earlyTitleColumns.map((column) => column.label),
        'Last run',
        ...lateTitleColumns.map((column) => column.label)
    ])
    const companyStatisticCount = $derived(companyStatisticHeadings.length)
    const defaultPlayerSort: SpreadsheetSort<PlayerSortKey> | undefined =
        untrack(() => session.passing) === 'pass-order'
            ? { key: 'turnOrder', direction: 'ascending' }
            : undefined
    let playerSort = $state(defaultPlayerSort)
    function cyclePlayerSort(key: PlayerSortKey) {
        const next = nextSpreadsheetSort(playerSort, key, playerSortColumns[key].directions)
        playerSort = next ?? (key === 'turnOrder' ? undefined : defaultPlayerSort)
    }
    const passedPlayerIds = $derived(
        session.gameState.machineState === 'StockRound' && !session.gameState.stockRound.completed
            ? session.gameState.stockRound.passedPlayerIds
            : []
    )
    let companySort = $state<SpreadsheetSort<CompanyStatistic>>()
    const seatedPlayers = $derived(
        seatOrder.map((playerId) => {
            const turn = playersWithBankruptLast(session.gameState).indexOf(playerId)
            assert(turn >= 0, 'Every seated player has a turn position')
            const passIndex = passedPlayerIds.indexOf(playerId)
            return {
                playerId,
                ...ownerStatisticsFor(
                    { kind: 'player', playerId },
                    session.playerCertificates(playerId)
                ),
                turnOrder: turn,
                ...(passIndex >= 0 ? { passOrder: passIndex + 1 } : {})
            }
        })
    )
    const playerOrder = $derived(
        sortedForSpreadsheet(seatedPlayers, playerSort, playerSortColumns).map(
            (player) => player.playerId
        )
    )
    const owners = $derived(
        [
            ...playerOrder.flatMap((playerId) => [
                {
                    id: `player:${playerId}`,
                    name: session.getPlayerName(playerId),
                    count: (companyId: string) => session.playerShares(companyId, playerId),
                    sells: (certificate: PurchaseCertificate) =>
                        certificate.owner.kind === 'player' &&
                        certificate.owner.playerId === playerId,
                    holder: (): CertificateHolder => ({ owner: { kind: 'player', playerId } })
                },
                ...portfolioOwners.filter((owner) => owner.controllerId === playerId)
            ]),
            ...portfolioOwners.filter((owner) => !owner.controllerId),
            ...(ipoPoolId
                ? [
                      {
                          id: 'ipo',
                          name: 'IPO',
                          count: (companyId: string) => poolShares(ipoPoolId, companyId),
                          sells: inPool(ipoPoolId),
                          holder: (): CertificateHolder => ({
                              owner: { kind: 'bank' },
                              poolId: ipoPoolId
                          })
                      }
                  ]
                : []),
            {
                id: 'market',
                name: session.terms.marketPool,
                count: (companyId: string) => poolShares(marketPoolId, companyId),
                sells: inPool(marketPoolId),
                holder: (): CertificateHolder => ({
                    owner: { kind: 'bank' },
                    poolId: marketPoolId
                })
            },
            {
                id: 'treasury',
                name: 'Treasury',
                count: (companyId: string) =>
                    sharesOwned(session.gameState, companyId, { kind: 'company', companyId }),
                sells: (certificate: PurchaseCertificate) =>
                    certificate.owner.kind === 'company' &&
                    certificate.owner.companyId === certificate.companyId,
                holder: (companyId: string): CertificateHolder => ({
                    owner: { kind: 'company', companyId }
                })
            },
            ...(exchangePoolId
                ? [
                      {
                          id: 'exchange',
                          name: 'Exchange',
                          count: (companyId: string) => poolShares(exchangePoolId, companyId),
                          holder: (): CertificateHolder => ({
                              owner: { kind: 'bank' },
                              poolId: exchangePoolId
                          })
                      }
                  ]
                : [])
        ].filter(
            (owner) =>
                (owner.id !== 'exchange' && owner.id !== 'treasury') ||
                companies.some((company) => owner.count(company.id) > 0)
        )
    )
    const includedPortfolioOwners = $derived(
        portfolioOwners.filter(
            (owner) =>
                owner.controllerId &&
                includedPortfolioCompanyIds.some((id) => owner.id === `company:${id}`)
        )
    )
    const footnoteId = $props.id()
    const ownerConnections = $derived(
        owners.map((owner, index) => {
            const controllerId = portfolioOwners.find(
                (entry) => entry.id === owner.id
            )?.controllerId
            const nextControllerId = portfolioOwners.find(
                (entry) => entry.id === owners[index + 1]?.id
            )?.controllerId
            return {
                controlled: !!controllerId,
                continues:
                    !!nextControllerId &&
                    (nextControllerId === controllerId || owner.id === `player:${nextControllerId}`)
            }
        })
    )
    const marketSpaces = $derived(
        new Map(
            companies.map((company) => [
                company.id,
                companyMarketSpace(
                    session.stockMarketChart,
                    session.gameState.stockMarket,
                    company.id
                )
            ])
        )
    )
    function presidentColumnId(companyId: string): string | undefined {
        const drafter = session.drafterOf(companyId)
        if (drafter) return `player:${drafter}`
        const president = presidentOf(session.gameState, companyId)
        if (president?.kind === 'player') return `player:${president.playerId}`
        if (president?.kind === 'company') return `company:${president.companyId}`
        return holdsReceiverPresidentCertificate(session.gameState, companyId, marketPoolId)
            ? 'market'
            : undefined
    }
    const companyRows = $derived(
        companies.map((company) => ({
            company,
            value: marketSpaces.get(company.id)?.price,
            valueMark: marketValueMark(
                marketSpaces.get(company.id),
                session.presentation.marketZones
            ),
            // Par is the IPO purchase price, so it only matters while the IPO is selling,
            // unless the title still prices company actions from it.
            par:
                ipoPoolId &&
                company.started &&
                !company.closed &&
                (pricePresentation.parWithoutIpoShares || poolShares(ipoPoolId, company.id) > 0)
                    ? shownParPrice(pricePresentation, session.gameState, company)
                    : undefined,
            stations: session.gameState.stations.filter(
                (station) => stationPlacer(session.mapView.map, station) === company.id
            ),
            cash: cashOwnedBy(session.gameState, { kind: 'company', companyId: company.id }),
            loans:
                session.loans.rules && company.started && company.kind !== 'private'
                    ? session.loans.loans(company.id)
                    : undefined,
            lastRun: companyLastRun(session.actions, session.gameState.actionCount, company.id),
            presidentId: presidentColumnId(company.id),
            shares: owners.map((owner) => owner.count(company.id)),
            shareNumbers: owners.map((owner) => playerShareNumbers(owner.id, company.id))
        }))
    )
    type CompanyRow = (typeof companyRows)[number]
    const showPar = $derived(
        pricePresentation.showPar && companyRows.some((row) => row.par !== undefined)
    )
    function parBefore(ownerId: string): boolean {
        return showPar && ownerId === 'ipo'
    }
    const companySortColumns = $derived.by(
        (): Record<CompanyStatistic, SpreadsheetSortColumn<CompanyRow>> => {
            const operatingOrder = orderedAs(
                session.stockMarketChart.order(session.gameState.stockMarket)
            )
            return {
                value: {
                    value: (row) => row.value,
                    tieOrder: (a, b) => operatingOrder(a.company.id, b.company.id)
                },
                cash: { value: (row) => (typeof row.cash === 'number' ? row.cash : undefined) },
                loans: { value: (row) => row.loans },
                lastRun: { value: (row) => row.company.lastRunRevenue },
                ...Object.fromEntries(
                    titleColumns.flatMap((column) => {
                        const { value } = column
                        return value
                            ? [
                                  [
                                      `column:${column.id}`,
                                      {
                                          value: (row: CompanyRow) =>
                                              value(session.gameState, row.company.id)
                                      }
                                  ]
                              ]
                            : []
                    })
                )
            }
        }
    )
    const rows = $derived(sortedForSpreadsheet(companyRows, companySort, companySortColumns))
    const statistics = $derived(
        new Map([
            ...seatedPlayers.map((player): [string, OwnerStatistics] => [
                `player:${player.playerId}`,
                player
            ]),
            ...portfolioCompanyIds.map((companyId): [string, OwnerStatistics] => [
                `company:${companyId}`,
                ownerStatisticsFor({ kind: 'company', companyId })
            ])
        ])
    )
    function ownerPlayerColor(ownerId: string) {
        return ownerId.startsWith('player:')
            ? session.playerColorValue(ownerId.slice(7))
            : undefined
    }
    function poolAlternate(ownerId: string) {
        return (
            owners
                .filter((owner) => owner.id in poolColumnLabels)
                .findIndex((owner) => owner.id === ownerId) %
                2 ===
            1
        )
    }
    function ownerTintColor(ownerId: string) {
        const controllerId = portfolioOwners.find((entry) => entry.id === ownerId)?.controllerId
        return (
            ownerPlayerColor(ownerId) ??
            (controllerId ? session.playerColorValue(controllerId) : undefined)
        )
    }
    const privateHolders = $derived<SpreadsheetPrivateHolder[]>([
        ...playerOrder.map((playerId) => ({
            id: `player:${playerId}`,
            owner: { kind: 'player', playerId } as const,
            side: 'owner' as const
        })),
        ...portfolioCompanyIds.map((companyId) => ({
            id: `company:${companyId}`,
            owner: { kind: 'company', companyId } as const,
            side: 'owner' as const
        })),
        ...companies
            .filter((company) => !portfolioCompanyIds.includes(company.id))
            .map((company) => ({
                id: `company:${company.id}`,
                owner: { kind: 'company', companyId: company.id } as const,
                side: 'company' as const
            }))
    ])
    const heldPrivates = $derived(
        spreadsheetPrivates(
            privateHolders,
            (owner) => session.portfolio(owner).privates,
            session.privates.companies.map((company) => company.id)
        )
    )
    const legendPrivates = $derived(
        heldPrivates.toSorted((a, b) =>
            privateName(a.company.id).localeCompare(privateName(b.company.id))
        )
    )
    const showLegend = $derived(heldPrivates.length > 0)
    const showOwnerPrivates = $derived(heldPrivates.some((held) => held.side === 'owner'))
    const showCompanyPrivates = $derived(heldPrivates.some((held) => held.side === 'company'))
    function privatesHeldBy(holderId: string, side: PrivateHolderSide) {
        return heldPrivates.filter((held) => held.holderId === holderId && held.side === side)
    }
    function privateInitials(companyId: string) {
        return session.lotInitials(getCompany(session.gameState, companyId))
    }
    function privateName(companyId: string) {
        return session.lotName({ id: companyId, name: session.companyName(companyId) })
    }
    const firstPoolOwnerId = $derived(owners.find((owner) => owner.id in poolColumnLabels)?.id)
    const notchPoolSpan = $derived(
        owners.filter((owner) => owner.id in poolColumnLabels).length +
            (owners.some((owner) => parBefore(owner.id)) ? 1 : 0)
    )
    const notchCompanySpan = $derived(
        notchPoolSpan + companyStatisticCount + (showCompanyPrivates ? 1 : 0)
    )
    const notchOwnerSpan = $derived(ownerStatisticKeys.length + (showOwnerPrivates ? 1 : 0))
    /** A company's stations left of all it has, or a dash for one that has none. */
    function stationCount(stations: readonly Station[]): string {
        if (!stations.length) return '—'
        const available = stations.filter((station) => station.status === 'available').length
        return `${available}/${stations.length}`
    }
</script>

{#snippet companyValueCell(row: CompanyRow, statStart: boolean, operating: boolean)}
    <td
        class="bright-cell value-cell"
        class:company-stat-start={statStart}
        class:operating-column={operating}
        class:market-zone-tint={row.valueMark}
        style={row.valueMark?.style}
        title={row.valueMark?.title}
        >{row.value === undefined ? '—' : row.value.toLocaleString('en-US')}</td
    >
{/snippet}

{#snippet financialValue(ownerId: string, key: OwnerStatistic)}
    {@const values = statistics.get(ownerId)}
    {@const included =
        key === 'netWorth' && includedPortfolioOwners.some((owner) => owner.id === ownerId)}
    <span
        class:included-net-worth={included}
        aria-describedby={included ? `${footnoteId}-${ownerId}` : undefined}
        >{#if key === 'certs' && values?.certs}<CertificateCount
                count={values.certs.count}
                limit={values.certs.limit}
            />{:else}{values ? ownerStatisticColumns[key].text(values) : '—'}{/if}{#if included}<sup
                >*</sup
            >{/if}{#if key === 'cash' && values?.reserved}<small
                class="reserved"
                title="The cash the player’s bids hold back"
                >{money(values.reserved)} reserved</small
            >{/if}</span
    >
{/snippet}

{#snippet turnOrderSort()}
    {@render sortButton(
        'Player',
        spreadsheetSortDirection(playerSort, 'turnOrder'),
        'ascending',
        () => cyclePlayerSort('turnOrder'),
        { title: 'Sort players by turn order', toggle: true }
    )}
{/snippet}

{#snippet sortArrow(direction: SpreadsheetSortDirection, preview = false)}
    <span class="sort-arrow" class:preview aria-hidden="true"
        ><svg viewBox="0 0 8 6"
            ><path d={direction === 'ascending' ? 'M0 6 4 0 8 6Z' : 'M0 0 4 6 8 0Z'}></path></svg
        ></span
    >
{/snippet}

<!-- An unsorted header previews, on hover, the direction its first click applies. -->
{#snippet sortButton(
    label: string,
    direction: SpreadsheetSortDirection | undefined,
    firstDirection: SpreadsheetSortDirection,
    onclick: () => void,
    {
        title,
        toggle = false,
        ariaLabel
    }: { title?: string; toggle?: boolean; ariaLabel?: string } = {}
)}
    <button
        class="sort-header"
        {title}
        aria-label={ariaLabel}
        aria-pressed={toggle ? !!direction : undefined}
        {onclick}
        ><span class="sort-label">{label}</span>{#if direction}{@render sortArrow(
                direction
            )}{:else}{@render sortArrow(firstDirection, true)}{/if}</button
    >
{/snippet}

{#snippet companySortHeader(scope: 'col' | 'row', label: string, key: CompanyStatistic)}
    {@const direction = spreadsheetSortDirection(companySort, key)}
    <th {scope} class:company-stat-start={scope === 'col'} aria-sort={direction}
        >{@render sortButton(
            label,
            direction,
            firstSortDirection(companySortColumns[key]),
            () =>
                (companySort = nextSpreadsheetSort(
                    companySort,
                    key,
                    companySortColumns[key].directions
                ))
        )}</th
    >
{/snippet}

{#snippet titleHeader(scope: 'col' | 'row', column: (typeof titleColumns)[number])}
    {#if column.value}{@render companySortHeader(
            scope,
            column.label,
            `column:${column.id}`
        )}{:else}<th {scope} class:company-stat-start={scope === 'col'}>{column.label}</th>{/if}
{/snippet}

{#snippet playerSortHeader(scope: 'col' | 'row', key: OwnerStatistic, statStart = false)}
    {@const direction = spreadsheetSortDirection(playerSort, key)}
    <th {scope} class:stat-start={statStart} aria-sort={direction}
        >{@render sortButton(
            ownerStatisticColumns[key].label,
            direction,
            firstSortDirection(playerSortColumns[key]),
            () => cyclePlayerSort(key),
            { ariaLabel: ownerStatisticColumns[key].ariaLabel }
        )}</th
    >
{/snippet}

{#snippet ownerLabel(owner: { id: string; name: string }, column = false)}
    {@const color = ownerPlayerColor(owner.id)}
    {#if color}
        <PlayerName name={owner.name} {color} dot={false} />
    {:else if portfolioColumnLabels.has(owner.id)}
        <span class="owner-name portfolio-full">{owner.name}</span>
        <span class="owner-name portfolio-short">{portfolioColumnLabels.get(owner.id)}</span>
    {:else}<span class="owner-name"
            >{column ? (poolColumnLabels[owner.id] ?? owner.name) : owner.name}</span
        >{/if}
{/snippet}

{#snippet companyCash(cash: number | 'unlimited' | undefined)}
    {cashText(money, cash)}
{/snippet}

{#snippet loansCell(row: CompanyRow)}
    {#if row.loans === undefined}<span class="empty">—</span>{:else}{session.loans.held(
            row.company.id
        )}{/if}
{/snippet}

{#snippet lastRunCell(row: CompanyRow)}
    {@const company = row.company}
    {#if company.lastRunRevenue === undefined}<span class="empty">—</span>
    {:else if row.lastRun}
        {@const { run, withheld } = row.lastRun}
        <button
            class="last-run"
            class:withheld
            disabled={session.busy || session.updatingVisibleState}
            aria-label={`View ${session.companyName(company.id)}'s last run for ${money(company.lastRunRevenue)}${withheld ? ', withheld' : ''}`}
            onclick={() => onPreviewMap(run)}>{money(company.lastRunRevenue)}</button
        >
    {:else}<span class="last-run-revenue">{money(company.lastRunRevenue)}</span>{/if}
{/snippet}

{#snippet titleRow(column: (typeof titleColumns)[number])}
    <tr class="company-stat-start financial-row">
        {@render titleHeader('row', column)}
        {#each rows as row (row.company.id)}<td
                class:operating-column={row.company.id === operatingCompanyId}
                class="bright-cell">{@render titleCell(column, row.company.id)}</td
            >{/each}
        {@render ownerStatisticVoids()}
    </tr>
{/snippet}

{#snippet ownerStatisticVoids()}
    {#if !showLegend}{#each ownerStatisticKeys as _, index (index)}<td
                class:stat-start={index === 0}
                class="void"
            ></td>{/each}{/if}
{/snippet}

{#snippet privateMarks(holderId: string, side: PrivateHolderSide)}
    {@const held = privatesHeldBy(holderId, side)}
    {#if held.length}<span class="private-marks"
            >{#each held as entry (entry.company.id)}<span
                    class="private-mark"
                    title={privateName(entry.company.id)}>{privateInitials(entry.company.id)}</span
                >{/each}</span
        >{:else}<span class="empty">—</span>{/if}
{/snippet}

{#snippet privateLegend(colspan: number, rowspan: number)}
    {@const showIncome = !session.presentation.privatesWithoutIncome}
    {@const showValue = !session.presentation.privatesWithoutValue}
    <td class="void private-legend" {colspan} {rowspan}>
        <div class="private-legend-frame">
            <div
                class="private-legend-grid"
                style:--legend-numbers={Number(showIncome) + Number(showValue)}
                role="table"
                aria-label="Privates held"
            >
                <div class="legend-row legend-head" role="row">
                    <span role="columnheader">Privates</span>
                    <span role="columnheader"><span class="sr-only">Name</span></span>
                    {#if showIncome}<span role="columnheader" class="legend-number">Income</span
                        >{/if}
                    {#if showValue}<span role="columnheader" class="legend-number">Value</span>{/if}
                </div>
                {#each legendPrivates as entry (entry.company.id)}
                    <div class="legend-row" role="row">
                        <span role="cell" class="private-mark"
                            >{privateInitials(entry.company.id)}</span
                        >
                        <span role="cell" class="legend-name">{privateName(entry.company.id)}</span>
                        {#if showIncome}<span role="cell" class="legend-number"
                                >{money(entry.income)}</span
                            >{/if}
                        {#if showValue}<span role="cell" class="legend-number"
                                >{money(entry.value)}</span
                            >{/if}
                    </div>
                {/each}
            </div>
        </div>
    </td>
{/snippet}

{#snippet titleCell(column: (typeof titleColumns)[number], companyId: string)}
    {#if column.marks}<span
            class="title-marks"
            role="group"
            aria-label={column.text(session.gameState, companyId)}
            >{#each column.marks(session.gameState, companyId) as mark (mark.label)}{#if mark.imageUrl}<img
                        src={mark.imageUrl}
                        alt=""
                        title={mark.description}
                    />{:else}<span title={mark.description}>{mark.label}</span>{/if}{/each}</span
        >{:else}{column.text(session.gameState, companyId)}{/if}
{/snippet}

{#snippet companyTrains(companyId: string)}
    <span class="company-trains">
        {#each trainsOwnedBy(session.gameState, { kind: 'company', companyId }) as train (train.id)}
            <TrainBadge
                name={session.trainDepot.trainDefinition(train.definitionId).name}
                color={trainColors[train.definitionId]}
                obsolete={isObsoleteTrain(train)}
                tokens={session.presentation.trainTokens?.(session.gameState, train)}
            />
        {:else}<span class="empty">—</span>{/each}
    </span>
{/snippet}

{#snippet shareCell(
    shares: number,
    companyId: string,
    ownerId: string,
    poolStart = false,
    president = false,
    matrix = true,
    sold = false,
    operating = false,
    poolAlt = false,
    numbers: readonly number[] = []
)}
    {@const purchase = shares > 0 ? purchaseForCell(companyId, ownerId) : undefined}
    {@const marked = shares > 0 ? markedCertificate(companyId, ownerId) : undefined}
    {@const saleChoices = shares > 0 ? saleChoicesForCell(companyId, ownerId) : []}
    {@const presidentLabel = president ? session.presidentMark(companyId) : undefined}
    <td
        class:operating-column={operating}
        class:sold
        class:share-cell={matrix}
        class:available-pool={!matrix}
        class:pool-alt={poolAlt}
        class:empty={shares === 0}
        class:short={shares < 0}
        class:pool-start={poolStart}
        class:tradable={!!purchase || saleChoices.length > 0}
    >
        {#if purchase}
            <button
                class="share-trade"
                aria-label={`Buy ${session.companyName(companyId)} from ${owners.find((owner) => owner.id === ownerId)?.name}`}
                onclick={(event) =>
                    openShareConfirmation(event, { kind: 'buy', request: purchase.request })}
                >{@render shareValue(String(shares), presidentLabel, marked)}</button
            >
        {:else if saleChoices.length}
            <button
                class="share-trade"
                aria-label={`Sell ${session.companyName(companyId)} shares`}
                onclick={(event) =>
                    openShareConfirmation(event, { kind: 'sell', companyId, ownerId })}
                >{@render shareHolding(String(shares), presidentLabel, numbers, marked)}</button
            >
        {:else if shares < 0}
            <span class="share-value" title={`Short ${-shares}`}
                >{shares}<span class="sr-only"> short</span></span
            >
        {:else}
            {@render shareHolding(
                shares === 0 ? '' : String(shares),
                presidentLabel,
                numbers,
                marked
            )}
        {/if}
    </td>
{/snippet}

{#snippet parCell(par: number | undefined, operating: boolean)}
    <td class="pool-start value-cell" class:operating-column={operating}
        >{par?.toLocaleString('en-US') ?? '—'}</td
    >
{/snippet}

{#snippet shareValue(text: string, president: string | undefined, mark?: MultiShareMark)}
    <span class="share-value" class:president={!!president}
        >{text}{#if president || mark}<span
                class="badge"
                aria-label={[president ? session.terms.president : '', mark?.name ?? '']
                    .filter(Boolean)
                    .join(', ')}
                title={mark?.title}>{president ?? ''}{mark?.label ?? ''}</span
            >{/if}</span
    >
{/snippet}

{#snippet shareHolding(
    text: string,
    president: string | undefined,
    numbers: readonly number[],
    marked?: MultiShareMark
)}
    {#if numbers.length}
        {@const label = ` (${numbers.join(',')})`}
        <span class="noted-value" class:president={!!president} data-note={label}
            >{@render shareValue(text, president, marked)}<span class="value-note">{label}</span
            ></span
        >
    {:else}
        {@render shareValue(text, president, marked)}
    {/if}
{/snippet}

{#snippet companyLabel(company: Company)}
    <span class="company">
        {#if session.mapView.stations[company.id]}
            <CompanyToken appearance={session.mapView.stations[company.id]} size={22} />
        {/if}
        <span title={session.companyName(company.id)}>{session.companyInitials(company.id)}</span>
    </span>
{/snippet}

<div class="spreadsheet" class:fill-width={fillWidth}>
    <div class="toolbar" role="group" aria-label="Spreadsheet controls">
        <div
            class="view-toggle axis-toggle period-toggle"
            role="group"
            aria-label="Spreadsheet period"
            style:--segments={periods.length}
            style:--selected={periods.indexOf(period)}
        >
            <span class="thumb" aria-hidden="true"></span>
            {#each periods as option (option)}
                <button aria-pressed={period === option} onclick={() => (period = option)}
                    >{option === 'Player income'
                        ? 'Income'
                        : option === 'Company payouts'
                          ? 'Payouts'
                          : option}</button
                >
            {/each}
        </div>
        {#if period === 'Current'}<div
                class="view-toggle axis-toggle"
                role="group"
                aria-label="Spreadsheet view"
            >
                <button
                    class="swap-axes"
                    aria-label="Swap rows and columns"
                    title={view === 'Company' ? 'Show players as rows' : 'Show companies as rows'}
                    onclick={() =>
                        session.preferences.set(
                            { spreadsheetView: view === 'Company' ? 'player' : 'company' },
                            'family'
                        )}>X ↔ Y</button
                >
            </div>{/if}
    </div>
    <div class="sheet-spacing" aria-hidden="true"></div>
    <div class="sheet-content">
        {#if period !== 'Current'}
            <IncomeHistory
                {money}
                rounds={session.roundIncomeHistory()}
                players={seatOrder.map((playerId) => ({
                    playerId,
                    name: session.getPlayerName(playerId),
                    color: session.playerColorValue(playerId)
                }))}
                appearances={session.mapView.stations}
                view={period === 'Player income' ? 'Player' : 'Company'}
                companyInitials={(companyId) => session.companyInitials(companyId)}
                companyName={(companyId) => session.companyName(companyId)}
                {onPreviewMap}
            />
        {:else}
            <div
                class="table-scroll"
                {@attach chainSidewaysScroll}
                class:scrolled
                class:pin-label-column={pinLabelColumn}
                bind:clientWidth={scrollViewportWidth}
                onscroll={(event) => (scrolled = event.currentTarget.scrollLeft > 0)}
            >
                <div class="outlined-table">
                    <table
                        aria-label="Company share ownership"
                        class:transposed={view === 'Player'}
                    >
                        <colgroup>
                            <col class="label-column" />
                            {#if view === 'Company'}
                                {#each owners as owner (owner.id)}
                                    {#if parBefore(owner.id)}<col class="pool-section" />{/if}
                                    <col class:pool-section={owner.id in poolColumnLabels} />
                                {/each}
                                <col
                                    span={companyStatisticCount + (showCompanyPrivates ? 1 : 0)}
                                    class="financial-section"
                                />
                            {:else}
                                {#each companies as company (company.id)}<col />{/each}
                                <col span={notchOwnerSpan} class="financial-section" />
                            {/if}
                        </colgroup>
                        <thead>
                            <tr>
                                <th
                                    scope="col"
                                    class="axis-corner"
                                    bind:offsetWidth={labelColumnWidth}
                                >
                                    <span class="axis-labels"
                                        >{#if view === 'Player'}{@render turnOrderSort()}{:else}Company{/if}<span
                                            class="axis-split"
                                            ><span class="sr-only">{' / '}</span></span
                                        >{#if view === 'Player'}Company{:else}{@render turnOrderSort()}{/if}</span
                                    >
                                </th>
                                {#if view === 'Company'}
                                    {#each owners as owner, index (owner.id)}{#if parBefore(owner.id)}<th
                                                scope="col"
                                                class="pool-start">Par</th
                                            >{/if}<th
                                            scope="col"
                                            class:pool-start={owner.id === firstPoolId}
                                            class:current-player-column={currentPlayerOwners.has(
                                                owner.id
                                            )}
                                            class:player-tinted-header={!!ownerTintColor(owner.id)}
                                            class:controlled-tint={!ownerPlayerColor(owner.id)}
                                            style:--player-color={ownerTintColor(owner.id)}
                                            title={owner.name}
                                            ><span class="column-owner-label">
                                                {#if ownerConnections[index].controlled}<span
                                                        class="column-ownership-connector incoming"
                                                        aria-hidden="true"
                                                    ></span>{/if}
                                                {@render ownerLabel(owner, true)}
                                                {#if ownerConnections[index].continues}<span
                                                        class="column-ownership-connector outgoing"
                                                        aria-hidden="true"
                                                    ></span>{/if}
                                            </span></th
                                        >{/each}
                                    {@render companySortHeader(
                                        'col',
                                        pricePresentation.label,
                                        'value'
                                    )}
                                    {#if showCompanyPrivates}<th
                                            scope="col"
                                            class="company-stat-start">Privates</th
                                        >{/if}
                                    {@render companySortHeader('col', 'Cash', 'cash')}
                                    <th scope="col">Trains</th>
                                    <th scope="col">{session.terms.stationTokensHeading}</th>
                                    {#if loansLabel}{@render companySortHeader(
                                            'col',
                                            loansLabel,
                                            'loans'
                                        )}{/if}
                                    {#each earlyTitleColumns as column (column.id)}{@render titleHeader(
                                            'col',
                                            column
                                        )}{/each}
                                    {@render companySortHeader('col', 'Last run', 'lastRun')}
                                    {#each lateTitleColumns as column (column.id)}{@render titleHeader(
                                            'col',
                                            column
                                        )}{/each}
                                {:else}
                                    {#each rows as row (row.company.id)}
                                        <th
                                            scope="col"
                                            class:operating-column={row.company.id ===
                                                operatingCompanyId}
                                            aria-label={session.companyName(row.company.id)}
                                            >{@render companyLabel(row.company)}</th
                                        >
                                    {/each}
                                    {#if showOwnerPrivates}<th scope="col" class="stat-start"
                                            >Privates</th
                                        >{/if}
                                    {#each ownerStatisticKeys as key, index (key)}{@render playerSortHeader(
                                            'col',
                                            key,
                                            index === 0 && !showOwnerPrivates
                                        )}{/each}
                                {/if}
                            </tr>
                        </thead>
                        <tbody>
                            {#if view === 'Company'}
                                {#each rows as row (row.company.id)}
                                    <tr
                                        class:operating-company={row.company.id ===
                                            operatingCompanyId}
                                    >
                                        <th
                                            scope="row"
                                            aria-label={session.companyName(row.company.id)}
                                            >{@render companyLabel(row.company)}</th
                                        >
                                        {#each row.shares as shares, index (index)}{#if parBefore(owners[index].id)}{@render parCell(
                                                    row.par,
                                                    false
                                                )}{/if}{@render shareCell(
                                                shares,
                                                row.company.id,
                                                owners[index].id,
                                                owners[index].id === firstPoolId,
                                                row.presidentId === owners[index].id,
                                                !(owners[index].id in poolColumnLabels),
                                                soldThisRound(owners[index].id, row.company.id),
                                                false,
                                                poolAlternate(owners[index].id),
                                                row.shareNumbers[index]
                                            )}{/each}
                                        {@render companyValueCell(row, true, false)}
                                        {#if showCompanyPrivates}<td
                                                class="company-stat-start bright-cell"
                                                >{@render privateMarks(
                                                    `company:${row.company.id}`,
                                                    'company'
                                                )}</td
                                            >{/if}
                                        <td class="company-stat-start bright-cell"
                                            >{@render companyCash(row.cash)}</td
                                        >
                                        <td class="bright-cell"
                                            >{@render companyTrains(row.company.id)}</td
                                        >
                                        <td class="bright-cell token-cell"
                                            >{stationCount(row.stations)}</td
                                        >
                                        {#if loansLabel}<td class="company-stat-start bright-cell"
                                                >{@render loansCell(row)}</td
                                            >{/if}
                                        {#each earlyTitleColumns as column (column.id)}<td
                                                class="company-stat-start bright-cell"
                                                >{@render titleCell(column, row.company.id)}</td
                                            >{/each}
                                        <td class="company-stat-start"
                                            >{@render lastRunCell(row)}</td
                                        >
                                        {#each lateTitleColumns as column (column.id)}<td
                                                class="company-stat-start bright-cell"
                                                >{@render titleCell(column, row.company.id)}</td
                                            >{/each}
                                    </tr>
                                {/each}
                                {#if showOwnerPrivates}
                                    <tr class="financial-row stat-start">
                                        <th scope="row">Privates</th>
                                        {#each owners.filter((owner) => !(owner.id in poolColumnLabels)) as owner (owner.id)}
                                            <td
                                                class:bright-cell={statistics.has(owner.id)}
                                                class:player-financial={!!ownerTintColor(owner.id)}
                                                style:--player-color={ownerTintColor(owner.id)}
                                                >{@render privateMarks(owner.id, 'owner')}</td
                                            >
                                        {/each}
                                        {@render privateLegend(notchCompanySpan, notchOwnerSpan)}
                                    </tr>
                                {/if}
                                {#each ownerStatisticKeys as key, index (key)}
                                    <tr
                                        class="financial-row"
                                        class:stat-start={index === 0 && !showOwnerPrivates}
                                    >
                                        {@render playerSortHeader('row', key)}
                                        {#each owners as owner (owner.id)}
                                            {#if showLegend && owner.id in poolColumnLabels}{:else}
                                                {#if parBefore(owner.id)}<td class="pool-start void"
                                                    ></td>{/if}
                                                <td
                                                    class:pool-start={owner.id === firstPoolId &&
                                                        !parBefore(owner.id)}
                                                    class:bright-cell={statistics.has(owner.id)}
                                                    class:player-financial={!!ownerTintColor(
                                                        owner.id
                                                    )}
                                                    style:--player-color={ownerTintColor(owner.id)}
                                                    class:token-cell={key === 'shares' &&
                                                        statistics.has(owner.id)}
                                                    class:empty={!statistics.has(owner.id)}
                                                    class:void={owner.id in poolColumnLabels}
                                                    >{#if !(owner.id in poolColumnLabels)}{@render financialValue(
                                                            owner.id,
                                                            key
                                                        )}{/if}</td
                                                >{/if}
                                        {/each}
                                        {#if !showLegend}{#each { length: companyStatisticCount } as _, column (column)}<td
                                                    class="void"

                                                ></td>{/each}{:else if index === 0 && !showOwnerPrivates}{@render privateLegend(
                                                notchCompanySpan,
                                                notchOwnerSpan
                                            )}{/if}
                                    </tr>
                                {/each}
                            {:else}
                                {#each owners as owner, index (owner.id)}
                                    {#if parBefore(owner.id)}
                                        <tr class="pool-start pool-row">
                                            <th scope="row" class="non-player-owner">Par</th>
                                            {#each rows as row (row.company.id)}{@render parCell(
                                                    row.par,
                                                    row.company.id === operatingCompanyId
                                                )}{/each}
                                            {#if showLegend}{@render privateLegend(
                                                    notchOwnerSpan,
                                                    notchCompanySpan
                                                )}{:else}{#each ownerStatisticKeys as _, statIndex (statIndex)}<td
                                                        class:stat-start={statIndex === 0}
                                                        class="void"
                                                    ></td>{/each}{/if}
                                        </tr>
                                    {/if}
                                    <tr
                                        class:current-player={currentPlayerOwners.has(owner.id)}
                                        class:pool-start={owner.id === firstPoolId}
                                        class:after-par={parBefore(owner.id)}
                                        class:pool-row={owner.id in poolColumnLabels}
                                    >
                                        <th
                                            scope="row"
                                            title={owner.name}
                                            class:non-player-owner={!owner.id.startsWith('player:')}
                                            class:player-tinted-header={!!ownerTintColor(owner.id)}
                                            class:controlled-tint={!ownerPlayerColor(owner.id)}
                                            style:--player-color={ownerTintColor(owner.id)}
                                            class:controlled-owner={ownerConnections[index]
                                                .controlled}
                                            class:ownership-continues={ownerConnections[index]
                                                .continues}>{@render ownerLabel(owner)}</th
                                        >
                                        {#each rows as row (row.company.id)}{@render shareCell(
                                                row.shares[index],
                                                row.company.id,
                                                owner.id,
                                                false,
                                                row.presidentId === owner.id,
                                                !(owner.id in poolColumnLabels),
                                                soldThisRound(owner.id, row.company.id),
                                                row.company.id === operatingCompanyId,
                                                poolAlternate(owner.id),
                                                row.shareNumbers[index]
                                            )}{/each}
                                        {#if showLegend && owner.id in poolColumnLabels}{#if owner.id === firstPoolOwnerId && !parBefore(owner.id)}{@render privateLegend(
                                                    notchOwnerSpan,
                                                    notchCompanySpan
                                                )}{/if}{:else}
                                            {#if showOwnerPrivates}<td
                                                    class="stat-start"
                                                    class:bright-cell={statistics.has(owner.id)}
                                                    class:player-financial={!!ownerTintColor(
                                                        owner.id
                                                    )}
                                                    style:--player-color={ownerTintColor(owner.id)}
                                                    >{@render privateMarks(owner.id, 'owner')}</td
                                                >{/if}
                                            {#each ownerStatisticKeys as key, statIndex (key)}
                                                <td
                                                    class:stat-start={statIndex === 0 &&
                                                        !showOwnerPrivates}
                                                    class:bright-cell={statistics.has(owner.id)}
                                                    class:player-financial={!!ownerTintColor(
                                                        owner.id
                                                    )}
                                                    style:--player-color={ownerTintColor(owner.id)}
                                                    class:token-cell={key === 'shares' &&
                                                        statistics.has(owner.id)}
                                                    class:empty={!statistics.has(owner.id)}
                                                    class:void={owner.id in poolColumnLabels}
                                                    >{#if !(owner.id in poolColumnLabels)}{@render financialValue(
                                                            owner.id,
                                                            key
                                                        )}{/if}</td
                                                >
                                            {/each}{/if}
                                    </tr>
                                {/each}
                                <tr class="company-stat-start financial-row">
                                    {@render companySortHeader(
                                        'row',
                                        pricePresentation.label,
                                        'value'
                                    )}
                                    {#each rows as row (row.company.id)}{@render companyValueCell(
                                            row,
                                            false,
                                            row.company.id === operatingCompanyId
                                        )}{/each}
                                    {@render ownerStatisticVoids()}
                                </tr>
                                {#if showCompanyPrivates}
                                    <tr class="company-stat-start financial-row">
                                        <th scope="row">Privates</th>
                                        {#each rows as row (row.company.id)}<td
                                                class:operating-column={row.company.id ===
                                                    operatingCompanyId}
                                                class="bright-cell"
                                                >{@render privateMarks(
                                                    `company:${row.company.id}`,
                                                    'company'
                                                )}</td
                                            >{/each}
                                    </tr>
                                {/if}
                                <tr class="company-stat-start financial-row">
                                    {@render companySortHeader('row', 'Cash', 'cash')}
                                    {#each rows as row (row.company.id)}<td
                                            class:operating-column={row.company.id ===
                                                operatingCompanyId}
                                            class="bright-cell">{@render companyCash(row.cash)}</td
                                        >{/each}
                                    {@render ownerStatisticVoids()}
                                </tr>
                                <tr class="financial-row">
                                    <th scope="row">Trains</th>
                                    {#each rows as row (row.company.id)}<td
                                            class:operating-column={row.company.id ===
                                                operatingCompanyId}
                                            class="bright-cell"
                                            >{@render companyTrains(row.company.id)}</td
                                        >{/each}
                                    {@render ownerStatisticVoids()}
                                </tr>
                                <tr class="financial-row">
                                    <th scope="row">{session.terms.stationTokensHeading}</th>
                                    {#each rows as row (row.company.id)}
                                        <td
                                            class:operating-column={row.company.id ===
                                                operatingCompanyId}
                                            class="bright-cell token-cell"
                                            >{stationCount(row.stations)}</td
                                        >
                                    {/each}
                                    {@render ownerStatisticVoids()}
                                </tr>
                                {#if loansLabel}
                                    <tr class="company-stat-start financial-row">
                                        {@render companySortHeader('row', loansLabel, 'loans')}
                                        {#each rows as row (row.company.id)}<td
                                                class:operating-column={row.company.id ===
                                                    operatingCompanyId}
                                                class="bright-cell">{@render loansCell(row)}</td
                                            >{/each}
                                        {@render ownerStatisticVoids()}
                                    </tr>
                                {/if}
                                {#each earlyTitleColumns as column (column.id)}{@render titleRow(
                                        column
                                    )}{/each}
                                <tr class="company-stat-start financial-row">
                                    {@render companySortHeader('row', 'Last run', 'lastRun')}
                                    {#each rows as row (row.company.id)}<td
                                            class:operating-column={row.company.id ===
                                                operatingCompanyId}>{@render lastRunCell(row)}</td
                                        >{/each}
                                    {@render ownerStatisticVoids()}
                                </tr>
                                {#each lateTitleColumns as column (column.id)}{@render titleRow(
                                        column
                                    )}{/each}
                            {/if}
                        </tbody>
                    </table>
                    <SpreadsheetOutline />
                </div>
            </div>
            {#each includedPortfolioOwners as owner (owner.id)}
                <p class="wealth-footnote" id={`${footnoteId}-${owner.id}`}>
                    * {owner.name}'s net worth is included in its controlling player's net worth.
                </p>
            {/each}
        {/if}
    </div>
    <div
        class="share-confirmation trade-popover"
        popover="auto"
        role="dialog"
        aria-label="Confirm share trade"
        bind:this={shareConfirmation}
        style:top={`${confirmationPosition.top}px`}
        style:left={`${confirmationPosition.left}px`}
        ontoggle={(event) => {
            if (event.newState === 'closed') pendingTrade = undefined
        }}
    >
        {#if pendingPurchaseChoice?.result.details && pendingPurchaseChoice.certificate.kind === 'share'}
            <div class="trade-question">
                Buy {pendingPurchaseChoice.certificate.shares}
                <CompanyToken
                    appearance={session.mapView.stations[
                        pendingPurchaseChoice.certificate.companyId
                    ]}
                    size={24}
                />
                for {money(pendingPurchaseChoice.result.details.price)}?
            </div>
            <div class="trade-answer">
                {#if pendingPlayerPurchase}<button
                        class="confirm-trade buy"
                        disabled={tradingDisabled}
                        onclick={() => confirmBuy(pendingPlayerPurchase.request.buyer)}>Yes</button
                    >{/if}
                <button onclick={() => shareConfirmation?.hidePopover()}>No</button>
                {#if pendingCompanyPurchases.length}
                    <div class="company-buy-row">
                        {#each pendingCompanyPurchases as choice (ownerIdFor(choice.request.buyer))}
                            {#if choice.result.details}
                                {@const contribution = playerPurchaseContribution(
                                    choice.result.details,
                                    session.myPlayer?.id
                                )}
                                <button
                                    class="company-buy"
                                    disabled={tradingDisabled}
                                    data-purchase-buyer={ownerIdFor(choice.request.buyer)}
                                    onclick={() => confirmBuy(choice.request.buyer)}
                                >
                                    As {session.ownerName(
                                        choice.request.buyer
                                    )}{#if contribution > 0}{' + '}{money(contribution)}{/if}
                                </button>
                            {/if}
                        {/each}
                    </div>
                {/if}
            </div>
        {:else if pendingTrade?.kind === 'sell' && pendingSaleChoices.length}
            {@const maximumSale = Math.max(
                ...pendingSaleChoices.map((choice) => choice.sale.shares)
            )}
            <div class="trade-question">
                Sell
                <CompanyToken
                    appearance={session.mapView.stations[pendingTrade.companyId]}
                    size={24}
                />
                {maximumSale === 1 ? 'share' : 'shares'}?
            </div>
            {#if maximumSale === 1}
                <div class="sale-proceeds">
                    Proceeds {optionalMoney(money, pendingSaleChoices[0].result.details?.proceeds)}
                </div>
                <div class="trade-answer">
                    <button
                        class="confirm-trade sell"
                        disabled={tradingDisabled}
                        onclick={() => confirmSale(1)}>Yes</button
                    >
                    <button onclick={() => shareConfirmation?.hidePopover()}>No</button>
                </div>
            {:else}
                <div class="sale-options">
                    {#each pendingSaleChoices as choice (choice.sale.shares)}
                        <button
                            class="confirm-trade sell"
                            disabled={tradingDisabled}
                            aria-label={`Sell ${choice.sale.shares} ${choice.sale.shares === 1 ? 'share' : 'shares'} for ${optionalMoney(money, choice.result.details?.proceeds)}`}
                            data-sale-shares={choice.sale.shares}
                            onclick={() => confirmSale(choice.sale.shares)}
                        >
                            <span
                                >{choice.sale.shares}
                                {choice.sale.shares === 1 ? 'share' : 'shares'}</span
                            >
                            <strong>{optionalMoney(money, choice.result.details?.proceeds)}</strong>
                        </button>
                    {/each}
                </div>
                <div class="trade-answer">
                    <button onclick={() => shareConfirmation?.hidePopover()}>No</button>
                </div>
            {/if}
        {/if}
    </div>
</div>

<style>
    .reserved {
        display: block;
        font-size: 0.85em;
        font-weight: 400;
        opacity: 0.75;
        white-space: nowrap;
    }
    .share-confirmation {
        transform: translateX(-50%);
    }
    .trade-question,
    .trade-answer {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
    }
    .trade-question {
        white-space: nowrap;
    }
    .trade-answer {
        margin-top: 8px;
        flex-wrap: wrap;
    }
    .company-buy-row {
        display: flex;
        flex: 1 1 100%;
        justify-content: center;
        gap: 6px;
    }
    .trade-answer button,
    .sale-options button {
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
        padding: 3px 14px;
        background: var(--rail-surface-raised, #efe7db);
        color: inherit;
        font: inherit;
        cursor: pointer;
    }
    .share-confirmation .confirm-trade {
        color: #fff;
        font-weight: 700;
    }
    .share-confirmation .confirm-trade.buy {
        border-color: var(--trade-buy-border);
        background: var(--trade-buy);
    }
    .share-confirmation .confirm-trade.sell {
        border-color: var(--trade-sell-border);
        background: var(--trade-sell);
    }
    .share-confirmation .confirm-trade:hover:not(:disabled) {
        filter: brightness(1.12);
    }
    .trade-answer .company-buy {
        border-color: var(--rail-solid, #2c4652);
        background: var(--rail-solid, #2c4652);
        color: var(--rail-solid-text, #fff);
    }
    .trade-answer .company-buy:hover:not(:disabled) {
        filter: brightness(1.15);
    }
    .trade-answer button:disabled,
    .sale-options button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .sale-proceeds {
        margin-top: 6px;
        text-align: center;
        color: var(--rail-muted, #95816a);
    }
    .sale-options {
        display: grid;
        gap: 4px;
        margin-top: 8px;
    }
    .sale-options button {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        min-width: 150px;
    }
    .trade-answer button:focus-visible,
    .sale-options button:focus-visible,
    .share-trade:focus-visible {
        outline: 2px solid var(--rail-focus, #a87948);
        outline-offset: -2px;
    }
    td.tradable {
        padding: 0;
    }
    .share-trade {
        display: block;
        width: 100%;
        border: 0;
        padding: 4px var(--cell-padding-inline);
        background: transparent;
        color: inherit;
        font: inherit;
        cursor: pointer;
    }
    .share-trade:hover {
        background: var(--rail-surface-selected, #dfd1be);
    }
    .included-net-worth {
        color: var(--rail-muted, #998b79);
    }
    .included-net-worth sup {
        font-size: 9px;
        margin-left: 1px;
    }
    .wealth-footnote {
        margin: 4px 0 8px;
        padding-inline: 6px;
        color: var(--rail-muted, #887969);
        font-size: 11px;
    }
    .owner-name {
        display: inline-block;
        vertical-align: middle;
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .portfolio-short {
        display: none;
    }
    table {
        --sheet-cell: var(--rail-surface, #222c37);
        --sheet-label: var(--rail-surface-raised, #2b3744);
        --sheet-pool: var(--sheet-cell);
        --sheet-market: var(--rail-market, #1f343d);
        --sheet-financial: var(--rail-surface-inset, #1b232d);
        --sheet-sold: var(--rail-sold-this-round, #4a2a33);
        --sheet-rule: var(--rail-sheet-rule, #2f3b48);
        --sheet-divider: var(--rail-sheet-divider, #5b6d80);
    }
    .share-cell {
        --cell-fill: var(--sheet-financial);
    }
    .available-pool {
        --cell-fill: var(--sheet-pool);
    }
    td.available-pool.pool-alt {
        --cell-fill: color-mix(in srgb, #ffffff 3%, var(--sheet-pool));
    }
    .pool-row {
        --row-fill: var(--sheet-pool);
    }
    .financial-row {
        --row-fill: var(--sheet-financial);
    }
    .bright-cell,
    td:has(.last-run, .last-run-revenue) {
        --cell-fill: var(--sheet-financial);
    }
    td.player-financial {
        --cell-fill: color-mix(
            in srgb,
            var(--player-color) var(--player-tint, 15%),
            var(--sheet-cell)
        );
    }
    td.sold {
        --cell-fill: var(--sheet-sold);
    }
    td.value-cell {
        --cell-fill: var(--sheet-market);
    }
    td.value-cell.market-zone-tint {
        --cell-fill: var(--market-tint);
        color: var(--market-tint-ink);
    }
    td {
        background: var(--cell-fill, var(--row-fill, transparent));
    }
    tbody tr:hover td {
        background: color-mix(
            in srgb,
            var(--rail-text, #e3e9ef) 9%,
            var(--cell-fill, var(--row-fill, var(--sheet-cell)))
        );
    }
    tbody tr:hover th {
        background: color-mix(
            in srgb,
            var(--rail-text, #e3e9ef) 9%,
            var(--player-tinted-background, var(--sheet-label))
        );
    }
    td:has(.last-run) {
        position: relative;
        padding: 0;
    }
    .sort-header {
        display: inline-flex;
        align-items: baseline;
        gap: 3px;
        border: 0;
        padding: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        white-space: nowrap;
        cursor: pointer;
    }
    .financial-row .sort-header {
        flex-direction: row-reverse;
    }
    .sort-arrow svg {
        --label-cap-height: 0.73em;
        --arrow-height: 6px;
        position: relative;
        bottom: calc((var(--label-cap-height) - var(--arrow-height)) / 2);
        display: block;
        width: 8px;
        height: var(--arrow-height);
        fill: currentColor;
    }
    /* Room for Player's hover arrow before the corner's split line. */
    .sort-header + .axis-split {
        margin-left: 3px;
    }
    .sort-label {
        text-decoration: underline dotted color-mix(in srgb, currentColor 40%, transparent);
        text-decoration-thickness: 1px;
        text-underline-offset: 3px;
    }
    /* A negative margin cancels the preview's width and gap, so revealing it never shifts the label. */
    .sort-arrow.preview {
        margin-right: -11px;
        visibility: hidden;
        opacity: 0.45;
    }
    .financial-row .sort-arrow.preview {
        margin-right: 0;
        margin-left: -11px;
    }
    @media (hover: hover) {
        .sort-header:hover .sort-label {
            text-decoration-color: currentColor;
        }
        .sort-header:hover .sort-arrow.preview {
            visibility: visible;
        }
    }
    .sort-header:focus-visible {
        outline: 2px solid var(--rail-focus, #b8cddd);
        outline-offset: 2px;
    }
    .last-run {
        display: block;
        box-sizing: border-box;
        width: 100%;
        border: 0;
        padding: 4px var(--cell-padding-inline);
        background: transparent;
        color: inherit;
        font: inherit;
        font-variant-numeric: tabular-nums;
        cursor: pointer;
    }
    .last-run::after {
        content: '';
        position: absolute;
        inset: 0;
    }
    .last-run:hover:enabled::after {
        background: var(--rail-hover, #ffffff66);
    }
    .last-run:focus-visible {
        outline: 2px solid var(--rail-focus, #9e7752);
        outline-offset: -2px;
    }
    .last-run:disabled {
        cursor: default;
    }
    .withheld {
        color: var(--rail-negative, #b33a32);
    }

    thead th,
    tbody th {
        background: var(--sheet-label);
    }
    .axis-corner {
        overflow: hidden;
    }
    /* Labels take only their content's width, leaving a full-width sheet's spare room to the data. */
    .label-column {
        width: 0;
    }
    .axis-labels {
        display: inline-flex;
        align-items: center;
    }
    /* Taller than the cell, which clips it, so the line meets the cell's top and bottom edges. */
    .axis-split {
        align-self: center;
        width: 26px;
        height: 60px;
        margin: -21px 0;
        background: linear-gradient(
            to top right,
            transparent calc(50% - 0.75px),
            currentColor calc(50% - 0.75px) calc(50% + 0.75px),
            transparent calc(50% + 0.75px)
        );
        opacity: 0.55;
    }
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
    }
    th.player-tinted-header {
        background: var(--player-tinted-background);
    }
    tbody th.player-tinted-header {
        box-shadow: inset 3px 0 0 var(--player-color);
    }
    thead th.player-tinted-header {
        box-shadow: inset 0 3px 0 var(--player-color);
    }
    th.player-tinted-header.controlled-tint {
        box-shadow: none;
    }

    .company-trains {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 3px;
    }
    .title-marks {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 3px;
    }
    .title-marks img {
        width: 16px;
        height: 16px;
    }
    .share-value {
        position: relative;
        display: inline-block;
        text-box: trim-both cap alphabetic;
    }
    .share-value.president {
        font-weight: 650;
    }
    .badge {
        position: absolute;
        color: var(--rail-muted, #a79888);
        font-size: 9px;
        font-weight: 700;
        line-height: 1;
        left: 100%;
        margin-left: 2px;
        top: 0;
        text-box: trim-both cap alphabetic;
    }
    /* A hidden copy of the note before the value keeps the value centered in its cell. */
    .noted-value {
        white-space: pre;
    }
    .noted-value::before,
    .value-note {
        color: var(--rail-muted, #a79888);
        font-size: 0.85em;
    }
    .noted-value::before {
        content: attr(data-note);
        visibility: hidden;
    }
    .noted-value.president::before {
        margin-right: 7px;
    }
    .noted-value.president .value-note {
        margin-left: 7px;
    }
    .sheet-spacing {
        flex: 0 1 20px;
        min-height: 0;
    }
    .sheet-content {
        flex-shrink: 0;
        width: fit-content;
        max-width: 100%;
        margin-inline: auto;
    }
    .fill-width .sheet-spacing {
        display: none;
    }
    .fill-width .sheet-content {
        width: 100%;
    }
    .fill-width .sheet-content :global(table) {
        width: 100%;
    }
    .toolbar {
        display: flex;
        flex-shrink: 0;
        justify-content: center;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding-block: 8px;
        background: var(--rail-table-background, #18212b);
    }
    .table-scroll {
        overflow-x: auto;
    }
    .outlined-table {
        position: relative;
    }
    .view-toggle {
        display: flex;
        align-items: center;
        width: max-content;
        gap: 2px;
        padding: 2px;
        border-radius: 999px;
        background: var(--rail-surface, #222c37);
        margin: 0;
    }
    .view-toggle button {
        border: 0;
        border-radius: 999px;
        padding: 3px 12px;
        font: inherit;
        font-size: 12px;
        line-height: 16px;
        color: var(--rail-muted, #7f8e9e);
        background: transparent;
        cursor: pointer;
        white-space: nowrap;
    }
    .view-toggle button:hover {
        color: var(--rail-text, #e3e9ef);
    }
    .view-toggle button[aria-pressed='true'] {
        background: var(--rail-solid, #40576b);
        color: var(--rail-solid-text, #ffffff);
        font-weight: 600;
    }
    .period-toggle {
        position: relative;
        display: grid;
        grid-template-columns: repeat(var(--segments), minmax(0, 1fr));
        gap: 0;
    }
    .period-toggle button {
        position: relative;
        transition: color 180ms ease;
    }
    .period-toggle button[aria-pressed='true'] {
        background: transparent;
    }
    .period-toggle .thumb {
        position: absolute;
        top: 2px;
        bottom: 2px;
        left: 2px;
        width: calc((100% - 4px) / var(--segments));
        border-radius: 999px;
        background: var(--rail-solid, #40576b);
        transform: translateX(calc(var(--selected) * 100%));
        transition: transform 180ms ease;
    }
    @media (prefers-reduced-motion: reduce) {
        .period-toggle button,
        .period-toggle .thumb {
            transition: none;
        }
    }
    .view-toggle button:focus-visible {
        outline: 2px solid var(--rail-focus, #b8cddd);
        outline-offset: 1px;
    }
    .swap-axes {
        color: var(--rail-text, #e3e9ef);
    }
    .transposed .company {
        justify-content: center;
    }
    .spreadsheet {
        display: flex;
        flex-direction: column;
        height: 100%;
        container-type: inline-size;
        width: 100%;
        min-width: 0;
    }
    table {
        --cell-padding-inline: 13px;
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        margin: 0 0 8px;
    }
    th,
    td {
        padding: 4px 13px;
        border-bottom: 1px solid var(--sheet-rule);
    }
    /* :where() keeps these rules below the section dividers in specificity. */
    tr > :where(* + *:not(.void)) {
        border-left: 1px solid var(--sheet-rule);
    }
    thead th:has(> .column-owner-label > .incoming) {
        border-left: 0;
    }
    thead th {
        white-space: nowrap;
        font-size: 12px;
        color: var(--rail-text, #e3e9ef);
        font-weight: 600;
        border-bottom: 2px solid var(--sheet-divider);
    }
    th:first-child {
        text-align: left;
        padding-left: 12px;
    }
    tr > th:first-child {
        position: relative;
        z-index: 1;
        border-right: 2px solid var(--sheet-divider);
    }
    .pin-label-column tr > th:first-child {
        position: sticky;
        left: 0;
    }
    .scrolled tr > th:first-child {
        z-index: 3;
    }
    tbody th {
        font-weight: 500;
    }
    th.non-player-owner,
    .financial-row > th {
        text-align: right;
    }
    tbody th.controlled-owner {
        text-align: left;
    }
    th.controlled-owner {
        padding-left: 36px;
    }
    .controlled-owner::before {
        content: '';
        position: absolute;
        left: 19px;
        top: -1px;
        height: calc(50% + 1px);
        width: 12px;
        border-left: 1px solid var(--rail-border, #b7a58f);
        border-bottom: 1px solid var(--rail-border, #b7a58f);
        pointer-events: none;
    }
    .ownership-continues::after {
        content: '';
        position: absolute;
        left: 19px;
        top: calc(50% + 7px);
        bottom: -1px;
        border-left: 1px solid var(--rail-border, #b7a58f);
        pointer-events: none;
    }
    .controlled-owner.ownership-continues::after {
        top: 50%;
    }
    .column-owner-label {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        min-height: 20px;
    }
    .column-ownership-connector {
        flex: 1;
        min-width: 12px;
        border-top: 1px solid var(--rail-border, #b7a58f);
    }
    .column-ownership-connector.incoming {
        margin-left: calc(-1 * var(--cell-padding-inline));
    }
    .column-ownership-connector.outgoing {
        margin-right: calc(-1 * var(--cell-padding-inline));
    }
    td {
        text-align: center;
        font-variant-numeric: tabular-nums;
    }
    .company {
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
    }
    .stat-start > th,
    .stat-start > td {
        border-top: 2px solid var(--sheet-divider);
    }
    .transposed .stat-start {
        border-left: 2px solid var(--sheet-divider);
    }
    table:not(.transposed) .pool-start,
    table:not(.transposed) .company-stat-start {
        border-left: 2px solid var(--sheet-divider);
    }
    .transposed tr.pool-start > th,
    .transposed tr.pool-start > td {
        border-top: 2px solid var(--sheet-divider);
    }
    .transposed tr.company-stat-start > th,
    .transposed tr.company-stat-start > td {
        border-top: 2px solid var(--sheet-divider);
    }
    /* A short reads as a signed count in the negative colour. */
    .short .share-value {
        color: var(--rail-negative, #b33a32);
        font-style: italic;
    }
    .empty {
        color: var(--rail-muted, #a79888);
    }
    td.void {
        background: var(--rail-table-background, #18212b);
        border: 0;
    }
    tbody tr:hover td.void {
        background: var(--rail-table-background, #18212b);
    }
    .transposed tr.company-stat-start > td.void,
    .transposed tr.after-par > td.void {
        border-top: 0;
    }
    tr.stat-start > td.void {
        border-top: 2px solid var(--sheet-divider);
    }
    tbody tr:last-child > :not(.void) {
        border-bottom: 2px solid var(--sheet-divider);
    }
    .private-marks {
        display: inline-flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0 0.5em;
        max-inline-size: 6.5em;
        font-size: 0.85em;
        line-height: 1.25;
        vertical-align: middle;
    }
    .private-mark {
        font-weight: 500;
        letter-spacing: 0.02em;
    }
    td.private-legend {
        vertical-align: top;
        text-align: left;
        padding: 7px 4px 4px 14px;
    }
    .private-legend-frame {
        width: 0;
        min-width: 100%;
    }
    .private-legend-grid {
        display: grid;
        grid-template-columns: auto minmax(0, max-content) repeat(var(--legend-numbers), auto);
        justify-content: start;
        row-gap: 1px;
        font-size: 12px;
        line-height: 1.5;
    }
    .legend-row {
        display: contents;
    }
    .legend-row > span {
        padding-inline: 4px;
    }
    .legend-row > .legend-name {
        padding-inline-end: 10px;
    }
    .legend-head > span {
        color: var(--rail-muted, #a79888);
        font-size: 11px;
    }
    .legend-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .legend-number {
        text-align: right;
        font-variant-numeric: tabular-nums;
    }
    @container (max-width: 800px) {
        table {
            --cell-padding-inline: 7px;
        }
        th,
        td {
            padding-inline: 7px;
        }
    }
    @container (max-width: 560px) {
        table {
            --cell-padding-inline: 5px;
        }
        .portfolio-full {
            display: none;
        }
        .portfolio-short {
            display: block;
        }
        th,
        td {
            padding-inline: 5px;
        }
    }
</style>
