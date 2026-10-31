<script lang="ts">
    import { tick } from 'svelte'
    import { createTimeAgo, PlayerName } from '@tabletop/frontend-components'
    import type { GameAction } from '@tabletop/common'
    import ActionDescription from './ActionDescription.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        aggregateTurns,
        jumpIndex,
        replaySpan,
        type HistoryTurn
    } from '$lib/utils/actionAggregator.js'
    import { END_REASON_TEXT, endSummary } from '$lib/utils/endSummary.js'
    import { viewerVerb } from '$lib/model/score.js'

    const timeAgo = createTimeAgo()
    const gameSession = getGameSession()

    let scrollContainer: HTMLDivElement | undefined = $state()

    // While a turn replays, the list keeps the entries it showed before the replay began.
    type Replaying = { turnKey: string; turns: HistoryTurn[]; scrollTop: number }
    let replaying = $state<Replaying | null>(null)

    const viewerId = $derived(gameSession.myPlayer?.id)
    const liveTurns = $derived(
        aggregateTurns(
            gameSession.actions,
            gameSession.gameState,
            viewerId,
            gameSession.hasCompleteHistory
        )
    )
    const turns = $derived(replaying ? replaying.turns : liveTurns)

    // R-2.1: newest round first, newest turn first within it.
    const rounds = $derived.by(() => {
        const grouped: { round: number; turns: HistoryTurn[] }[] = []
        for (const turn of turns) {
            if (grouped.at(-1)?.round !== turn.round) grouped.push({ round: turn.round, turns: [] })
            grouped.at(-1)?.turns.push(turn)
        }
        return grouped.toReversed().map((round) => ({ ...round, turns: round.turns.toReversed() }))
    })

    const summary = $derived(
        !replaying && !gameSession.isViewingHistory ? endSummary(gameSession.gameState) : undefined
    )

    async function jump(turn: HistoryTurn) {
        const index = jumpIndex(turn)
        if (index === undefined || replaying) {
            return
        }
        await gameSession.history.goToActionIndex(index, { exact: true })
    }

    async function replay(turn: HistoryTurn) {
        const span = replaySpan(turn)
        if (span === undefined || replaying) {
            return
        }
        const frozen: Replaying = {
            turnKey: turn.key,
            turns: liveTurns,
            scrollTop: scrollContainer?.scrollTop ?? 0
        }
        replaying = frozen
        try {
            await gameSession.history.replayRange(span.start, span.end)
        } finally {
            replaying = null
            await tick()
            scrollContainer?.scrollTo({ top: frozen.scrollTop, behavior: 'auto' })
        }
    }

    function turnTime(actions: GameAction[], lastAt: Date | undefined): string {
        return actions.length > 0 && lastAt ? timeAgo.format(lastAt) : ''
    }
</script>

<div class="history">
    <div class="scroll" class:frozen={replaying} bind:this={scrollContainer}>
        {#if summary}
            <section class="summary" aria-label="Final totals">
                <div class="summary-head">
                    <span class="winners">
                        {#each summary.winnerIds as playerId, index (playerId)}
                            {#if index > 0}<span>and</span>{/if}
                            <PlayerName {playerId} />
                        {/each}
                        {viewerVerb(summary.winnerIds, viewerId, 'wins', 'win')}
                    </span>
                    {#if gameSession.game.finishedAt}
                        <span class="when">{timeAgo.format(gameSession.game.finishedAt)}</span>
                    {/if}
                </div>
                {#if summary.reason}
                    <p class="reason">{END_REASON_TEXT[summary.reason]}.</p>
                {/if}
                <table>
                    <thead>
                        <tr><th></th><th>Money</th><th>Shares</th><th>Total</th></tr>
                    </thead>
                    <tbody>
                        {#each summary.totals as total (total.playerId)}
                            <tr class:winner={summary.winnerIds.includes(total.playerId)}>
                                <td><PlayerName playerId={total.playerId} /></td>
                                <td>${total.money}</td>
                                <td>${total.shareValue}</td>
                                <td class="total">${total.total}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </section>
        {/if}
        {#each rounds as round (round.round)}
            <section class="round" aria-label="Round {round.round}">
                <div class="round-head">Round {round.round}</div>
                {#each round.turns as turn (turn.key)}
                    {@const color = gameSession.colors.getPlayerUiColor(turn.playerId)}
                    {@const active = replaying?.turnKey === turn.key}
                    <article
                        class="turn"
                        class:active
                        class:dimmed={replaying && !active}
                        style:--seat={color}
                    >
                        <div class="turn-head">
                            <PlayerName playerId={turn.playerId} />
                            <span class="turn-number">Turn {turn.turnNumber}</span>
                            {#if active}
                                <span class="replaying-tag">Replaying</span>
                            {:else if !turn.ended && !summary}
                                <span class="in-progress">playing</span>
                            {/if}
                            <span class="when">{turnTime(turn.actions, turn.lastAt)}</span>
                        </div>
                        {#if turn.rows.length > 0}
                            <ul class="rows">
                                {#each turn.rows as row (row.key)}
                                    <li>
                                        {#if row.playerId}<PlayerName
                                                playerId={row.playerId}
                                            />{' '}{/if}<ActionDescription parts={row.parts} />
                                    </li>
                                {/each}
                                {#if turn.sellingPlayerId}
                                    <li class="selling">
                                        <PlayerName playerId={turn.sellingPlayerId} />
                                        {viewerVerb([turn.sellingPlayerId], viewerId, 'is', 'are')} selling…
                                    </li>
                                {/if}
                            </ul>
                        {/if}
                        {#if turn.actions.length > 0}
                            <div class="controls">
                                {#if turn.ended}
                                    <button
                                        type="button"
                                        disabled={replaying !== null}
                                        title="Show the table as this turn ended"
                                        onclick={() => jump(turn)}>Jump</button
                                    >
                                {/if}
                                <button
                                    type="button"
                                    disabled={replaying !== null}
                                    title="Replay this turn"
                                    onclick={() => replay(turn)}>Replay</button
                                >
                            </div>
                        {/if}
                    </article>
                {/each}
            </section>
        {/each}
        <div class="milestone">
            <span>Game started</span>
            <span class="when">{timeAgo.format(gameSession.game.createdAt)}</span>
        </div>
    </div>
</div>

<style>
    .history {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 300px;
        overflow: hidden;
        border-radius: 4px;
        background: var(--pp-panel);
        color: var(--pp-ink);
        font-size: 14px;
        text-align: left;
    }

    .scroll {
        height: 100%;
        overflow: auto;
        padding: 0 8px 10px;
    }

    .scroll.frozen {
        overflow: hidden;
    }

    .round-head {
        position: sticky;
        top: 0;
        z-index: 1;
        margin: 0 -8px;
        padding: 8px 12px 2px;
        background: var(--pp-panel);
        font-family: 'Libre Caslon Text', serif;
        font-style: italic;
        font-size: 12.5px;
        text-align: center;
        color: var(--pp-brown);
    }

    /* The interstitial's hairline. */
    .round-head::after {
        content: '';
        display: block;
        margin-top: 4px;
        border-top: 1px solid color-mix(in srgb, var(--pp-brown) 40%, transparent);
    }

    /* A paper entry with a left rule in the actor's seat colour. */
    .turn {
        margin-top: 8px;
        padding: 5px 10px 6px;
        border-left: 4px solid var(--seat);
        border-radius: 2px;
        background: var(--pp-paper);
        box-shadow: 0 1px 0 color-mix(in srgb, var(--pp-halo) 20%, transparent);
    }

    .turn.active {
        background: color-mix(in srgb, var(--pp-accent) 16%, transparent);
    }

    .turn.dimmed {
        opacity: 0.45;
    }

    .turn-head {
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: 'Oswald', sans-serif;
        font-weight: 600;
        letter-spacing: 0.03em;
        text-transform: uppercase;
    }

    .turn-number,
    .when,
    .in-progress {
        font-family: 'Libre Caslon Text', serif;
        font-style: italic;
        letter-spacing: 0;
        text-transform: none;
    }

    .turn-number {
        font-size: 11px;
        font-weight: 400;
        color: var(--pp-ink-sub);
    }

    .in-progress {
        font-size: 11px;
        font-weight: 400;
        color: var(--pp-ink-sub);
    }

    .replaying-tag {
        padding: 0 6px;
        border-radius: 999px;
        background: var(--pp-accent);
        color: var(--pp-accent-ink);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
    }

    .when {
        margin-left: auto;
        font-size: 11px;
        font-weight: 400;
        color: var(--pp-ink-sub);
        white-space: nowrap;
    }

    .rows {
        margin: 2px 0 0;
        padding: 0;
        list-style: none;
        font-size: 13px;
        line-height: 1.5;
    }

    .selling {
        font-style: italic;
        color: var(--pp-ink-sub);
    }

    .controls {
        display: flex;
        gap: 6px;
        margin-top: 4px;
    }

    .controls button {
        min-height: 26px;
        padding: 0 10px;
        border: 1.5px solid var(--pp-charcoal);
        border-radius: 3px;
        background: transparent;
        color: var(--pp-charcoal);
        font-family: 'Oswald', sans-serif;
        font-size: 12px;
        font-weight: 500;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .controls button:hover:not(:disabled),
    .controls button:focus-visible {
        background: var(--pp-paper-deep);
        outline: none;
    }

    .controls button:disabled {
        opacity: 0.5;
    }

    .summary {
        margin: 10px 0 4px;
        padding: 8px 10px;
        border-radius: 2px;
        border: 1.5px dashed color-mix(in srgb, var(--pp-brown) 55%, transparent);
        background: var(--pp-paper);
    }

    .summary-head {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .winners {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 5px;
        font-family: 'Oswald', sans-serif;
        font-size: 16px;
        font-weight: 600;
    }

    .reason {
        margin: 2px 0 6px;
        font-family: 'Libre Caslon Text', serif;
        font-style: italic;
        font-size: 12px;
        color: var(--pp-ink-sub);
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
    }

    th {
        font-size: 11px;
        font-weight: 400;
        color: var(--pp-ink-sub);
        text-align: right;
    }

    td {
        padding: 2px 0;
        text-align: right;
    }

    td:first-child {
        text-align: left;
    }

    tr.winner .total {
        font-family: 'Oswald', sans-serif;
        font-weight: 600;
    }

    tr.winner td {
        border-bottom: 2px solid var(--pp-accent);
    }

    .milestone {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 14px 0 2px;
        padding: 6px 10px;
        border-top: 1px solid color-mix(in srgb, var(--pp-brown) 40%, transparent);
        font-family: 'Libre Caslon Text', serif;
        font-style: italic;
        color: var(--pp-brown);
        font-size: 13px;
    }
</style>
