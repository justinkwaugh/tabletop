<script lang="ts">
    import { historyStates } from './historyStates.js'
    import { ActionSource, assertExists, type GameAction } from '@tabletop/common'
    import { controllingOwner } from '@tabletop/18xx'
    import { historyCompanyChanges } from './historyCompanyChanges.js'
    import { historyCash } from './historyCash.js'
    import { historyOperatingOrder } from './historyOperatingOrder.js'
    import { historyRounds } from './historyRounds.js'
    import type { CompanyNameVariants } from './companyPresentation.js'
    import { historyGroups } from './historyGroups.js'
    import { historyDescription, type TitleActionDescription } from './historyDescription.js'
    import HistoryGroup from './HistoryGroup.svelte'
    import OperatingOrderHistory from './OperatingOrderHistory.svelte'
    import RoundHistory from './RoundHistory.svelte'
    import AuctionHistoryCard from './AuctionHistoryCard.svelte'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let {
        session,
        onPreviewMap,
        phaseColors,
        phaseTileColors,
        tileColors,
        tileColorNames,
        trainColors,
        describeAction,
        companyNames
    }: {
        onPreviewMap: (action: GameAction) => void
        session: EighteenXXSessionView
        trainColors: Readonly<Record<string, string>>
        phaseColors: Readonly<Record<string, string>>
        phaseTileColors: Readonly<Record<string, readonly string[]>>
        tileColors?: Readonly<Record<string, string>>
        tileColorNames?: Readonly<Record<string, string>>
        companyNames?: Readonly<Record<string, CompanyNameVariants>>
        describeAction?: TitleActionDescription
    } = $props()
    const money = $derived(session.presentation.money)
    const jumpDisabled = $derived(
        session.busy || session.updatingVisibleState || session.history.isDisabled()
    )
    function jumpToHistory(index: number) {
        if (!jumpDisabled) void session.history.goToActionIndex(index, { exact: true })
    }
    const newestFirst = $derived(session.preferences.values.historyOrder === 'newestFirst')
    const context = $derived(session.history.visibleContext)
    const gameState = $derived(context.state)
    const states = $derived(historyStates(context.actions, gameState))
    const orderChanges = $derived(historyOperatingOrder(context.actions, states))
    const cash = $derived(historyCash(states))
    const companyChanges = $derived(historyCompanyChanges(context.actions))
    // A system action the title describes is one of its own events, unless it is routine.
    const rounds = $derived(
        historyRounds(context.actions, gameState, states, orderChanges, cash, {
            isEvent: (action) => {
                if (action.source !== ActionSource.System) return false
                const description = describeAction?.(action, companyName, () =>
                    describeShared(action)
                )
                return !!description && !description.routine
            },
            rounds: session.presentation.titleRounds
        })
    )
    const currentHeaderId = $derived(session.isViewingHistory ? rounds[0]?.id : undefined)
    function returnToCurrent() {
        if (!jumpDisabled) void session.history.goToEnd()
    }
    function fullCompanyName(id: string) {
        return session.companyName(id)
    }
    function companyName(id: string) {
        return companyNames?.[id]?.history ?? fullCompanyName(id)
    }
    function describeShared(action: GameAction) {
        return historyDescription(
            action,
            gameState,
            session.stockMarketChart,
            companyName,
            (id) => session.getPlayerName(id),
            companyChanges.get(action.id),
            session.presentation.money
        )
    }
    function describe(action: GameAction) {
        const shared = () => describeShared(action)
        const description = describeAction?.(action, companyName, shared) ?? shared()
        return orderChanges.has(action.id) ? { ...description, important: true } : description
    }

    function lot(lotId: string) {
        const lot = session.offers.model?.lots.find((lot) => lot.id === lotId)
        assertExists(lot, 'Auction history requires a known offered lot')
        return lot
    }
</script>

<RoundHistory
    {currentHeaderId}
    onReturn={returnToCurrent}
    onJump={jumpToHistory}
    {jumpDisabled}
    {rounds}
    {phaseColors}
    {newestFirst}
    historyComplete={context.hasCompleteHistory}
    onOrderChange={(first) =>
        session.preferences.set({ historyOrder: first ? 'newestFirst' : 'newestLast' }, 'family')}
>
    {#snippet orderContent(order)}
        <OperatingOrderHistory {order} stations={session.mapView.stations} {companyName} />
    {/snippet}
    {#snippet children(round)}
        {@const groups = historyGroups(round.entries, round.label.startsWith('OR '))}
        <ol aria-label={`${round.label} actions`}>
            {#each newestFirst ? groups : groups.toReversed() as entry (entry.id)}
                {#if entry.kind === 'auction'}
                    <li class="auction">
                        <AuctionHistoryCard
                            {money}
                            card={entry}
                            lot={lot(entry.offer.lotId)}
                            playerName={(id) => session.getPlayerName(id)}
                            playerColor={(id) => session.colors.getPlayerBgColorValue(id)}
                        />
                    </li>
                {:else}
                    <li>
                        <HistoryGroup
                            {money}
                            {newestFirst}
                            group={entry}
                            onReturn={round.id === currentHeaderId &&
                            entry.id === groups.find((group) => group.kind === 'operation')?.id
                                ? returnToCurrent
                                : undefined}
                            onJump={jumpToHistory}
                            {jumpDisabled}
                            {onPreviewMap}
                            previewActionId={session.historicalMap?.actionId}
                            appearance={entry.companyId
                                ? session.mapView.stations[entry.companyId]
                                : undefined}
                            playerName={(id) => session.getPlayerName(id)}
                            playerColor={(id) => session.colors.getPlayerBgColorValue(id)}
                            currentController={(id) => controllingOwner(gameState, id)?.playerId}
                            {phaseColors}
                            {phaseTileColors}
                            {tileColors}
                            {tileColorNames}
                            {trainColors}
                            shareCards={(action) => session.shareCards(action)}
                            trainName={(id) => session.trainDepot.trainDefinition(id).name}
                            {orderChanges}
                            {cash}
                            stations={session.mapView.stations}
                            {describe}
                            {companyName}
                        />
                    </li>
                {/if}
            {/each}
        </ol>
    {/snippet}
</RoundHistory>

<style>
    ol {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    li {
        margin: 0;
        padding: 0;
    }
</style>
