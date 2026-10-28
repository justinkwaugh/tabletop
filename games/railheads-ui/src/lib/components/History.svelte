<script lang="ts">
    import { CalledGameDescription, PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { SPACE_NAMES, describeAction, winVerb } from '$lib/utils/describeAction.js'
    import {
        entryActions,
        historyEntries,
        historyLines,
        type HistoryEntry
    } from '$lib/utils/history.js'
    import Description from './Description.svelte'
    import CompanyBadge from './CompanyBadge.svelte'

    const gameSession = getGameSession()

    const chronological = $derived(
        historyEntries(gameSession.actions.toSorted((a, b) => (a.index ?? 0) - (b.index ?? 0)))
    )
    const entries = $derived(chronological.toReversed())
    const entryNumbers = $derived(
        new Map(chronological.map((entry, index) => [entry.key, index + 1]))
    )

    async function jumpTo(entry: HistoryEntry) {
        const index = entryActions(entry).at(-1)?.index
        if (index !== undefined) {
            await gameSession.history.goToActionIndex(index)
        }
    }

    function onKey(event: KeyboardEvent, entry: HistoryEntry) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void jumpTo(entry)
        }
    }
</script>

<div class="history">
    {#if gameSession.gameState.result && !gameSession.gameCall && gameSession.gameState.winningPlayerIds.length > 0}
        <div class="milestone">
            Game over:
            {#each gameSession.gameState.winningPlayerIds as playerId, index (playerId)}
                {#if index > 0}and{/if}
                <PlayerName
                    {playerId}
                    capitalization={index > 0 && playerId === gameSession.myPlayerId
                        ? 'none'
                        : 'capitalize'}
                />
            {/each}
            {winVerb(gameSession.gameState.winningPlayerIds, gameSession.myPlayerId)}
        </div>
    {/if}
    {#each entries as entry (entry.key)}
        {#if entry.kind === 'call'}
            <div class="milestone"><CalledGameDescription action={entry.action} /></div>
        {:else if entry.kind === 'payout'}
            <div
                class="milestone jump"
                role="button"
                tabindex="0"
                onclick={() => jumpTo(entry)}
                onkeydown={(event) => onKey(event, entry)}
            >
                <span class="number">No. {entryNumbers.get(entry.key)}</span>
                <Description description={describeAction(entry.action)} />
            </div>
        {:else}
            {@const lines = historyLines(entry)}
            <section class="entry">
                <div
                    class="head jump"
                    role="button"
                    tabindex="0"
                    title="Show the board after this"
                    onclick={() => jumpTo(entry)}
                    onkeydown={(event) => onKey(event, entry)}
                >
                    <span class="number">No. {entryNumbers.get(entry.key)}</span>
                    {#if entry.kind === 'turn'}
                        <PlayerName playerId={entry.playerId} />
                        <span class="box"
                            >{entry.space ? SPACE_NAMES[entry.space] : 'Consolidate'}</span
                        >
                    {:else}
                        <span>Initial offering</span>
                        {#if entry.companyId}<CompanyBadge companyId={entry.companyId} />{/if}
                    {/if}
                </div>
                {#if lines.length > 0}
                    <div class="lines">
                        {#each lines as line (line.key)}
                            {#if line.kind === 'bids'}
                                <div class="bids">
                                    {#each line.bids as bid (bid.playerId)}
                                        <span class="who"
                                            ><PlayerName playerId={bid.playerId} /></span
                                        >
                                        <span class="amount">${bid.amount}</span>
                                        <span class="note">{bid.note}</span>
                                    {/each}
                                </div>
                            {:else}
                                <span class="who">
                                    {#if line.playerId}<PlayerName playerId={line.playerId} />{/if}
                                </span>
                                <span class="what {line.tone}">
                                    <Description description={line.description} />
                                </span>
                            {/if}
                        {/each}
                    </div>
                {/if}
            </section>
        {/if}
    {/each}
</div>

<style>
    .history {
        display: flex;
        flex-direction: column;
        gap: 6px;
        color: #26300f;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 13px;
    }

    .milestone {
        border-radius: 6px;
        background: #33401a;
        color: #f4f0d8;
        padding: 4px 8px;
        text-align: center;
    }

    .entry {
        border-radius: 6px;
        background: #f6f2da;
        box-shadow: inset 0 0 0 1px #b9b48a;
        padding: 4px 8px 6px;
    }

    .head {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
    }

    .number {
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 11px;
        font-weight: 700;
        opacity: 0.7;
    }

    .box {
        font-style: italic;
        font-weight: 400;
        color: #5b5a36;
    }

    .jump {
        cursor: pointer;
    }

    .lines {
        display: grid;
        grid-template-columns: max-content minmax(0, 1fr);
        column-gap: 6px;
        row-gap: 3px;
        align-items: baseline;
        padding: 3px 0 0 8px;
    }

    .who {
        justify-self: start;
        white-space: nowrap;
    }

    .what.result {
        font-weight: 700;
    }

    .what.aside {
        color: #6d6a45;
        font-style: italic;
    }

    .bids {
        grid-column: 1 / -1;
        min-width: 0;
        margin-left: 12px;
        display: grid;
        grid-template-columns: max-content max-content minmax(0, max-content);
        column-gap: 6px;
        row-gap: 2px;
        align-items: baseline;
        justify-self: start;
        border-left: 2px solid #d6d0a8;
        padding-left: 10px;
        font-variant-numeric: tabular-nums;
    }

    .amount {
        text-align: right;
    }

    .note {
        color: #6d6a45;
        font-style: italic;
    }
</style>
