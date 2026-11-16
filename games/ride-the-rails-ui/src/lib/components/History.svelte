<script lang="ts">
    import { CalledGameDescription } from '@tabletop/frontend-components'
    import { isCallGameAction } from '@tabletop/common'
    import { PhaseName, isEndRound } from '@tabletop/ride-the-rails'
    import { PHASE_LABELS } from '$lib/model/actionArea.js'
    import { roundTickets } from '$lib/utils/marginTracks.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction } from '$lib/utils/describeAction.js'
    import {
        historyEntries,
        journeyPayouts,
        journeyRoute,
        jumpTarget,
        openEntryKey,
        replayRange,
        turnDescription,
        type HistoryEntry
    } from '$lib/utils/history.js'
    import Description from './Description.svelte'
    import RailroadName from './RailroadName.svelte'
    import RoundTicket from './panel/RoundTicket.svelte'
    import SeatDot from './panel/SeatDot.svelte'

    const gameSession = getGameSession()

    const tickets = $derived(roundTickets(gameSession.gameState.mapId))

    function seatName(playerId: string): string {
        return playerId === gameSession.myPlayerId ? 'You' : gameSession.getPlayerName(playerId)
    }

    // `actions` and the managers follow the displayed state, so in History View the list ends at
    // the displayed step (docs/game-ui-layout.md, History description).
    const entries = $derived(
        historyEntries(
            gameSession.actions,
            gameSession.gameState.roundManager.series,
            gameSession.gameState.phaseManager.series
        )
    )

    // A replay walks the displayed state through the entry; the list holds still meanwhile.
    let frozen: HistoryEntry[] | undefined = $state()
    const shown = $derived(frozen ?? entries)
    const openKey = $derived(openEntryKey(shown))

    async function jump(entry: HistoryEntry) {
        const target = jumpTarget(entry)
        if (target && !frozen) {
            await gameSession.history.goToActionIndex(target.actionIndex, { exact: target.exact })
        }
    }

    async function replay(entry: HistoryEntry) {
        const range = replayRange(entry)
        if (!range || frozen) {
            return
        }
        frozen = entries
        try {
            await gameSession.history.replayRange(range.startIndex, range.endIndex)
        } finally {
            frozen = undefined
        }
    }
</script>

<!-- Oldest first, newest at the foot. The reversed column keeps the scroll pinned to the foot as
     entries arrive. -->
<div
    class="flex h-full min-h-[300px] flex-col-reverse overflow-y-auto rounded-lg border border-rtr-line bg-rtr-table/60 p-2 text-left text-[13px] leading-snug text-rtr-ink"
>
    <ol class="flex flex-col gap-1.5" aria-label="Game history">
        {#each shown as entry (entry.key)}
            {#if entry.kind === 'phase'}
                <li>
                    <!-- R-2.1: a new round is a banner across the list; each phase a small label
                         under it. Both jump to the phase's start. -->
                    {#if entry.phase === PhaseName.TakeShare}
                        {@const ticket = tickets[entry.round - 1]}
                        <div class="round-banner">
                            <span class="rtr-display">Round</span>
                            {#if ticket}<RoundTicket {ticket} />{/if}
                        </div>
                    {/if}
                    <button
                        type="button"
                        class="phase-label jumpable hover:enabled:text-rtr-ink"
                        disabled={!!frozen}
                        onclick={() => jump(entry)}
                        >{PHASE_LABELS[entry.phase]}<span class="sr-only"
                            >, round {entry.round}: jump to the start of this phase</span
                        ></button
                    >
                </li>
            {:else if entry.kind === 'milestone'}
                <li>
                    {#if isCallGameAction(entry.action)}
                        <div class="interstitial">
                            <CalledGameDescription action={entry.action} />
                        </div>
                    {:else if isEndRound(entry.action) && entry.action.metadata}
                        {@const ended = entry.action.metadata}
                        <!-- R-2.5: the round's close as a small card: the new turn order with each
                             seat's money, and the railroad it makes available. -->
                        <button
                            type="button"
                            class="round-end jumpable"
                            disabled={!!frozen}
                            onclick={() => jump(entry)}
                        >
                            <span class="round-end-title"
                                >Round {ended.round} ends<span class="sr-only"
                                    >: jump to the new turn order</span
                                ></span
                            >
                            <span class="round-end-label">New turn order</span>
                            <table class="order">
                                <tbody>
                                    {#each ended.money as seat, index (seat.playerId)}
                                        <tr>
                                            <td class="rank">{index + 1}</td>
                                            <td><SeatDot playerId={seat.playerId} /></td>
                                            <td class="who">{seatName(seat.playerId)}</td>
                                            <td class="cash">${seat.money}</td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                            {#if ended.railroadId}
                                <span class="arrives">
                                    <RailroadName railroadId={ended.railroadId} /> now available
                                </span>
                            {/if}
                        </button>
                    {:else}
                        <div class="interstitial">
                            <Description
                                description={describeAction(entry.action)}
                                plainNames
                                nameDots
                            />
                        </div>
                    {/if}
                </li>
            {:else}
                {@const canReplay = replayRange(entry) !== undefined}
                {@const payouts = journeyPayouts(entry)}
                {@const route = journeyRoute(entry)}
                <li
                    class="flex items-start gap-2 rounded-md border border-rtr-line bg-rtr-panel px-2 py-1.5"
                    class:open={entry.key === openKey}
                >
                    <span class="mt-[3px]"><SeatDot playerId={entry.playerId} /></span>
                    <span class="min-w-0 flex-1">
                        <Description description={turnDescription(entry)} plainNames />
                        {#if route}
                            <span class="block">{route.ends}</span>
                            <span class="block text-rtr-ink-muted"
                                >{route.cities} total cities – Fare ${route.fare}</span
                            >
                        {/if}
                        {#if payouts.length > 0}
                            <table class="payouts" aria-label="Paid">
                                <tbody>
                                    {#each payouts as payout (payout.playerId)}
                                        <tr>
                                            <td><SeatDot playerId={payout.playerId} /></td>
                                            <td class="who">{seatName(payout.playerId)}</td>
                                            <td class="amount">${payout.amount}</td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        {/if}
                    </span>
                    <span class="flex shrink-0 items-center gap-1 text-[11px] text-rtr-ink-muted">
                        <button
                            type="button"
                            class="link hover:enabled:text-rtr-ink hover:enabled:underline"
                            disabled={!!frozen}
                            onclick={() => jump(entry)}>jump</button
                        >
                        {#if canReplay}
                            <span aria-hidden="true">·</span>
                            <button
                                type="button"
                                class="link hover:enabled:text-rtr-ink hover:enabled:underline"
                                disabled={!!frozen}
                                onclick={() => replay(entry)}>replay</button
                            >
                        {/if}
                    </span>
                </li>
            {/if}
        {/each}
    </ol>
</div>

<style>
    .interstitial {
        display: block;
        width: 100%;
        margin-top: 4px;
        padding-top: 4px;
        border-top: 1px solid var(--rtr-line);
        color: var(--rtr-ink-muted);
        font-size: 11.5px;
        letter-spacing: 0.06em;
        text-align: center;
        text-transform: uppercase;
    }

    .round-banner {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 14px 0 2px;
        color: var(--rtr-ink);
        font-size: 19px;
        letter-spacing: 0.04em;
    }

    .round-banner::before,
    .round-banner::after {
        content: '';
        flex: 1;
        height: 2px;
        border-radius: 1px;
        background: var(--rtr-card-edge);
    }

    .round-end {
        display: flex;
        width: 100%;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        margin-top: 6px;
        padding: 6px 10px 8px;
        border: 1px solid var(--rtr-card-edge);
        border-radius: 8px;
        background: var(--rtr-panel-raised);
        color: var(--rtr-ink);
    }

    .round-end-title {
        font-size: 13px;
        font-weight: 700;
    }

    .round-end-label {
        color: var(--rtr-ink-muted);
        font-size: 10.5px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .order {
        border-collapse: collapse;
        font-size: 12.5px;
    }

    .order td {
        padding: 1px 4px;
    }

    .order tr + tr td {
        border-top: 1px solid var(--rtr-rule);
    }

    .order .who {
        text-align: left;
    }

    .order .cash {
        text-align: right;
    }

    .rank {
        color: var(--rtr-ink-muted);
        font-size: 11px;
        text-align: right;
    }

    .cash {
        font-weight: 600;
    }

    .arrives {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 12px;
        color: var(--rtr-ink-muted);
    }

    .phase-label {
        display: block;
        width: 100%;
        margin-top: 2px;
        color: var(--rtr-ink-muted);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-align: center;
        text-transform: uppercase;
    }

    .payouts {
        margin-top: 3px;
        border-collapse: collapse;
        font-size: 12px;
    }

    .payouts td {
        padding: 0 6px 0 0;
    }

    .payouts .amount {
        text-align: right;
        font-weight: 600;
    }

    .jumpable:not(:disabled) {
        cursor: pointer;
    }

    .jumpable:focus-visible {
        color: var(--rtr-ink);
    }

    .open {
        box-shadow: inset 3px 0 0 var(--rtr-accent);
    }

    .link {
        padding: 2px 0;
        cursor: pointer;
    }

    .link:focus-visible {
        color: var(--rtr-ink);
        text-decoration: underline;
    }

    @media (max-width: 639px) {
        /* A finger-sized press on a phone. */
        .link {
            padding: 6px 3px;
        }
    }

    .link:disabled {
        cursor: default;
        text-decoration: none;
    }
</style>
