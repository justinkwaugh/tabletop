<script lang="ts">
    import { assert, assertExists, type GameAction } from '@tabletop/common'
    import { FinanceExampleValidator } from '@tabletop/18xx'
    import { historyCompanyChanges } from './historyCompanyChanges.js'
    import { historyCash } from './historyCash.js'
    import { historyOperatingOrder } from './historyOperatingOrder.js'
    import { historyRounds } from './historyRounds.js'
    import type { CompanyNameVariants } from './companyPresentation.js'
    import { historyGroups } from './historyGroups.js'
    import { historyDescription, type HistoryDescription } from './historyDescription.js'
    import HistoryGroup from './HistoryGroup.svelte'
    import RoundHistory from './RoundHistory.svelte'
    import AuctionHistoryCard from './AuctionHistoryCard.svelte'
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    let {
        session,
        onPreviewMap,
        phaseColors,
        phaseTileColors,
        trainColors,
        describeAction,
        companyNames
    }: {
        onPreviewMap: (action: GameAction) => void
        session: FinanceExampleSession
        trainColors: Readonly<Record<string, string>>
        phaseColors: Readonly<Record<string, string>>
        phaseTileColors: Readonly<Record<string, readonly string[]>>
        companyNames?: Readonly<Record<string, CompanyNameVariants>>
        describeAction?: (action: GameAction) => HistoryDescription | undefined
    } = $props()
    const newestFirst = $derived(session.preferences.values.historyOrder === 'newestFirst')
    const context = $derived(session.history.visibleContext)
    const state = $derived.by(() => {
        assert(FinanceExampleValidator.Check(context.state), 'History requires financial state')
        return context.state
    })
    const orderChanges = $derived(historyOperatingOrder(context.actions, state))
    const cash = $derived(historyCash(context.actions, state))
    const companyChanges = $derived(historyCompanyChanges(context.actions, state))
    const rounds = $derived(historyRounds(context.actions, state, orderChanges, cash))
    function fullCompanyName(id: string) {
        return state.companies.find((company) => company.id === id)?.name ?? id
    }
    function companyName(id: string) {
        return companyNames?.[id]?.short ?? fullCompanyName(id)
    }
    function describe(action: GameAction) {
        const description =
            describeAction?.(action) ??
            historyDescription(action, state, companyName, (id) =>
                session.getPlayerName(id), companyChanges.get(action.id)
            )
        return orderChanges.has(action.id) ? { ...description, important: true } : description
    }

    function lot(lotId: string) {
        const lot = session.offerAuction?.lots.find((lot) => lot.id === lotId)
        assertExists(lot, 'Auction history requires a known offered lot')
        return lot
    }
</script>

<RoundHistory {rounds} {phaseColors} {newestFirst}
    onOrderChange={(first) => session.preferences.set({ historyOrder: first ? 'newestFirst' : 'newestLast' }, 'family')}>

    {#snippet children(round)}
        {@const groups = historyGroups(round.entries, round.label.startsWith('OR '))}
        <ol aria-label={`${round.label} actions`}>
            {#each newestFirst ? groups : groups.toReversed() as entry (entry.id)}
                {#if entry.kind === 'auction'}
                    <li class="auction">
                        <AuctionHistoryCard
                            card={entry}
                            lot={lot(entry.offer.lotId)}
                            playerName={(id) => session.getPlayerName(id)}
                        />
                    </li>
                {:else}
                    <li>
                        <HistoryGroup
                            group={entry}
                            {onPreviewMap}
                            previewActionId={session.historicalMap?.actionId}
                            appearance={entry.companyId
                                ? session.mapView.stations[entry.companyId]
                                : undefined}
                            playerName={(id) => session.getPlayerName(id)}
                            {phaseColors}
                            {phaseTileColors}
                            {trainColors}
                            trainName={(id) => session.trainDepot.trainDefinition(id).name}
                            {orderChanges}
                            {cash}
                            stations={session.mapView.stations}
                            {describe}
                            companyName={fullCompanyName}
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
