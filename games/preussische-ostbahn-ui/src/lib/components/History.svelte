<script lang="ts">
    import { CalledGameDescription, PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        END_REASONS,
        actionSale,
        describeAction,
        expansionDescription,
        expansionFacts,
        saleDescription,
        withoutSubject
    } from '$lib/utils/describeAction.js'
    import { historyEntries, type HistoryEntry } from '$lib/utils/history.js'
    import {
        isBuildTrack,
        isCapitalize,
        isCompleteExpansion,
        isDeterminePlayerOrder,
        isEndExpansion,
        isPassBid,
        isPayDividends,
        isPlaceBid
    } from '@tabletop/preussische-ostbahn'
    import type { GameAction } from '@tabletop/common'
    import Description from './Description.svelte'
    import RailroadBadge from './RailroadBadge.svelte'

    const gameSession = getGameSession()

    const entries = $derived(
        historyEntries(
            gameSession.actions.toSorted((a, b) => (a.index ?? 0) - (b.index ?? 0))
        ).toReversed()
    )

    function shownActions(actions: readonly GameAction[]): GameAction[] {
        const finished = actions.findLastIndex(
            (action) => isEndExpansion(action) || isCompleteExpansion(action)
        )
        const sold = actions.some((action) => actionSale(action) !== undefined)
        return actions.filter(
            (action, index) =>
                !(isBuildTrack(action) && index < finished) &&
                !(
                    sold &&
                    (isPlaceBid(action) || isPassBid(action) || isCapitalize(action)) &&
                    !actionSale(action)
                )
        )
    }

    function incomeBefore(
        actions: readonly GameAction[],
        finished: GameAction
    ): number | undefined {
        let before: number | undefined
        for (const action of actions.slice(0, actions.indexOf(finished))) {
            if (isBuildTrack(action) && action.metadata?.incomeBefore !== undefined) {
                before = action.metadata.incomeBefore
            }
        }
        return before
    }

    function highBids(actions: readonly GameAction[]): { playerId: string; amount: number }[] {
        const best = new Map<string, number>()
        for (const action of actions) {
            if (isPlaceBid(action)) {
                best.set(action.playerId, Math.max(best.get(action.playerId) ?? 0, action.amount))
            }
        }
        return [...best].map(([playerId, amount]) => ({ playerId, amount }))
    }

    function saleLine(entry: HistoryEntry, action: GameAction) {
        const sale = actionSale(action)
        if (!sale) {
            return line(entry, action)
        }
        const description = saleDescription(sale)
        return entry.kind === 'turn' ? withoutSubject(description, entry.playerId) : description
    }

    function line(entry: HistoryEntry, action: GameAction) {
        const description = describeAction(action)
        return entry.kind === 'turn' ? withoutSubject(description, entry.playerId) : description
    }
</script>

<div class="history po-serif">
    {#each entries as entry (entry.key)}
        {#if entry.kind === 'call'}
            <div class="milestone"><CalledGameDescription action={entry.action} /></div>
        {:else if entry.kind === 'round'}
            {@const action = entry.action}
            {#if isDeterminePlayerOrder(action) && action.metadata?.endReason}
                <div class="milestone">Game over · {END_REASONS[action.metadata.endReason]}</div>
            {:else if isDeterminePlayerOrder(action)}
                <div class="milestone">
                    <div class="round">Round {entry.round}</div>
                    <div class="order">
                        {#each action.metadata?.drawn ?? [] as playerId, index (index)}
                            <span
                                class="slot"
                                title={gameSession.getPlayerName(playerId)}
                                style:background={gameSession.colors.getPlayerUiColor(playerId)}
                                style:color={gameSession.colors.getPlayerTextColorValue(playerId)}
                                >{gameSession.playerInitial(playerId)}</span
                            >
                        {/each}
                    </div>
                </div>
            {/if}
        {:else if entry.kind === 'dividends'}
            {@const action = entry.action}
            {#if isPayDividends(action) && action.metadata}
                {@const payout = action.metadata}
                <section class="payout">
                    <div class="payout-head">Dividends paid</div>
                    <div class="trigger">
                        <RailroadBadge railroadId={payout.railroadId} short /> made a new connection and
                        pays double
                    </div>
                    <div class="payees">
                        {#each payout.payouts.toSorted((a, b) => b.amount - a.amount) as paid (paid.playerId)}
                            <div class="payee" class:nothing={paid.amount === 0}>
                                <span class="payee-name"
                                    ><PlayerName playerId={paid.playerId} /></span
                                >
                                <span class="amount">${paid.amount}</span>
                            </div>
                        {/each}
                    </div>
                    <div class="rates">
                        {#each payout.rates.filter((rate) => rate.perShare > 0) as rate (rate.railroadId)}
                            <span class="rate"
                                ><RailroadBadge railroadId={rate.railroadId} short /> ${rate.perShare}</span
                            >
                        {/each}
                        <span>per share</span>
                    </div>
                </section>
            {/if}
        {:else}
            <section class="entry">
                {#if entry.kind === 'turn'}
                    <div
                        class="head"
                        style:background={gameSession.colors.getPlayerUiColor(entry.playerId)}
                        style:color={gameSession.colors.getPlayerTextColorValue(entry.playerId)}
                    >
                        {gameSession.displayName(entry.playerId)}
                    </div>
                {:else}
                    <div class="head auction-head">
                        <span>Opening auction</span>
                        <RailroadBadge railroadId={entry.railroadId} short />
                    </div>
                {/if}
                <div class="lines">
                    {#each shownActions(entry.actions) as action (action.id)}
                        {#if expansionFacts(action)}
                            {@const facts = expansionFacts(
                                action,
                                incomeBefore(entry.actions, action)
                            )}
                            {@const summary = expansionDescription(action) ?? []}
                            <div>
                                <Description short description={summary.slice(0, 3)} />
                                <div class="facts">{facts}</div>
                            </div>
                        {:else if actionSale(action)}
                            {@const bids = highBids(entry.actions)}
                            <div>
                                <Description short description={saleLine(entry, action)} />
                                {#if bids.length > 0}
                                    <div class="facts bids">
                                        <span>High bids</span>
                                        {#each bids as bid (bid.playerId)}
                                            <span class="bid">
                                                <span
                                                    class="slot small"
                                                    title={gameSession.getPlayerName(bid.playerId)}
                                                    style:background={gameSession.colors.getPlayerUiColor(
                                                        bid.playerId
                                                    )}
                                                    style:color={gameSession.colors.getPlayerTextColorValue(
                                                        bid.playerId
                                                    )}
                                                    >{gameSession.playerInitial(bid.playerId)}</span
                                                >${bid.amount}
                                            </span>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        {:else}
                            <div><Description short description={line(entry, action)} /></div>
                        {/if}
                    {/each}
                </div>
            </section>
        {/if}
    {/each}
</div>

<style>
    .history {
        display: flex;
        flex-direction: column;
        gap: 8px;
        color: var(--po-ink);
        font-size: 14px;
        line-height: 1.45;
    }

    .milestone {
        border-radius: 6px;
        background: var(--po-table-rule);
        color: var(--po-table-ink);
        padding: 5px 10px 7px;
        text-align: center;
    }

    .round {
        font-family: 'Ostbahn Alegreya', Georgia, serif;
        font-size: 15px;
        font-weight: 700;
        margin-bottom: 2px;
    }

    .entry {
        overflow: hidden;
        border-radius: 6px;
        background: var(--po-card);
        box-shadow: inset 0 0 0 1px var(--po-rule);
    }

    .head {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px 4px;
        box-shadow: inset 0 -1.5px rgba(0, 0, 0, 0.22);
        font-family: 'Ostbahn Alegreya', Georgia, serif;
        font-size: 15px;
        font-weight: 700;
    }

    .auction-head {
        background: var(--po-table);
        color: var(--po-table-ink);
    }

    .lines {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 6px 10px 8px;
    }

    .order {
        display: flex;
        justify-content: center;
        gap: 5px;
    }

    .slot {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 5px;
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
        font-family: 'Ostbahn Alegreya', Georgia, serif;
        font-size: 14px;
        font-weight: 700;
    }

    .facts {
        color: var(--po-muted);
        font-size: 13px;
    }

    .bids {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 10px;
        margin-top: 2px;
    }

    .bid {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        color: var(--po-ink);
    }

    .slot.small {
        width: 18px;
        height: 18px;
        border-radius: 4px;
        font-size: 11px;
    }

    .payout {
        overflow: hidden;
        border-radius: 6px;
        background: var(--po-card);
        box-shadow: inset 0 0 0 2px #2e7d4a;
    }

    .payout-head {
        background: #2e7d4a;
        color: #f4efe0;
        padding: 3px 10px 4px;
        font-family: 'Ostbahn Alegreya', Georgia, serif;
        font-size: 15px;
        font-weight: 700;
    }

    .trigger {
        padding: 6px 10px 2px;
    }

    .payees {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 4px 10px;
    }

    .payee {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .payee.nothing {
        color: var(--po-muted);
    }

    .payee-name {
        flex: 1;
    }

    .amount {
        font-family: 'Ostbahn Alegreya', Georgia, serif;
        font-size: 17px;
        font-weight: 700;
        font-variant-numeric: lining-nums tabular-nums;
    }

    .rates {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 8px;
        padding: 2px 10px 8px;
        color: var(--po-muted);
        font-size: 12px;
    }

    .rate {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        color: var(--po-ink);
    }
</style>
