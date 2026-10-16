<script lang="ts">
    import type { GameAction } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        SPACE_NAMES,
        actionSale,
        describeAction,
        saleDescription,
        winVerb,
        withdrawnBidders
    } from '$lib/utils/describeAction.js'
    import { entryActions, historyEntries, type HistoryEntry } from '$lib/utils/history.js'
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

    function detailActions(entry: HistoryEntry): GameAction[] {
        return entry.kind === 'turn' ? entry.actions.slice(1) : entryActions(entry)
    }
</script>

<div class="history">
    {#if gameSession.gameState.result && gameSession.gameState.winningPlayerIds.length > 0}
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
        {#if entry.kind === 'payout'}
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
                        <span class="box">{entry.space ? SPACE_NAMES[entry.space] : 'Consolidate'}</span>
                    {:else}
                        <span>Initial offering</span>
                        {#if entry.companyId}<CompanyBadge companyId={entry.companyId} />{/if}
                    {/if}
                </div>
                {#each detailActions(entry) as action (action.id)}
                    {@const sale = actionSale(action)}
                    <div class="line">
                        {#if action.playerId}<PlayerName playerId={action.playerId} />{/if}
                        <Description description={describeAction(action)} />
                    </div>
                    {#each withdrawnBidders(action) as playerId (playerId)}
                        <div class="line sub"><PlayerName {playerId} /> cannot afford to bid on</div>
                    {/each}
                    {#if sale}
                        <div class="line result"><Description description={saleDescription(sale)} /></div>
                    {/if}
                {/each}
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
        font-family: 'Libre Baskerville', Georgia, serif;
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
        font-family: 'Libre Baskerville', Georgia, serif;
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

    .line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        padding-left: 8px;
    }

    .line.sub {
        color: #6d6a45;
        font-style: italic;
    }

    .line.result {
        font-weight: 700;
    }
</style>
