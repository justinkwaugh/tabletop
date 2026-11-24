<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction, describeDetails, winVerb } from '$lib/utils/describeAction.js'
    import { historyEntries, type HistoryEntry } from '$lib/utils/history.js'
    import Description from './Description.svelte'

    const gameSession = getGameSession()

    const entries = $derived(
        historyEntries(
            gameSession.actions.toSorted((a, b) => (a.index ?? 0) - (b.index ?? 0)),
            gameSession.gameState.roundManager.series
        ).toReversed()
    )

    function lastIndex(entry: HistoryEntry): number | undefined {
        switch (entry.kind) {
            case 'round':
                return entry.lastIndex
            case 'system':
                return entry.action.index
            case 'turn':
                return entry.actions.at(-1)?.index
        }
    }

    async function jumpTo(entry: HistoryEntry) {
        const index = lastIndex(entry)
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
    {#if gameSession.gameState.result && gameSession.gameState.winningPlayerIds.length > 0}
        <div class="milestone">
            Game over:
            {#each gameSession.gameState.winningPlayerIds as playerId, index (playerId)}
                {#if index > 0}and{/if}
                <PlayerName {playerId} />
            {/each}
            {winVerb(gameSession.gameState.winningPlayerIds, gameSession.myPlayerId)}
        </div>
    {/if}
    {#each entries as entry (entry.key)}
        {#if entry.kind === 'round'}
            <div
                class="milestone"
                class:jump={entry.lastIndex !== undefined}
                role="button"
                tabindex="0"
                title="Show the board at the end of this round"
                onclick={() => jumpTo(entry)}
                onkeydown={(event) => onKey(event, entry)}
            >
                Round {entry.number}
            </div>
        {:else if entry.kind === 'system'}
            <section class="entry system">
                <div
                    class="head jump"
                    role="button"
                    tabindex="0"
                    onclick={() => jumpTo(entry)}
                    onkeydown={(event) => onKey(event, entry)}
                >
                    <Description description={describeAction(entry.action)} />
                </div>
                {#each describeDetails(entry.action) as line, index (index)}
                    <div class="line"><Description description={line} /></div>
                {/each}
            </section>
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
                    <PlayerName playerId={entry.playerId} />
                </div>
                {#each entry.actions as action (action.id)}
                    <div class="line"><Description description={describeAction(action)} /></div>
                    {#each describeDetails(action) as line, index (index)}
                        <div class="line sub"><Description description={line} /></div>
                    {/each}
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
        color: #232d36;
        font-family: 'LW Baskerville', Georgia, serif;
        font-size: 13px;
    }

    .milestone {
        border-radius: 6px;
        background: #25303a;
        color: #dbe3ea;
        padding: 3px 8px;
        font-family: 'LW Playfair', Georgia, serif;
        font-size: 15px;
        text-align: center;
    }

    .entry {
        border-radius: 6px;
        background: #e9eef2;
        box-shadow: inset 0 0 0 1px #a7b8c5;
        padding: 4px 8px 6px;
    }

    .entry.system {
        background: #dbe3e9;
    }

    .head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        font-weight: 700;
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
        padding-left: 18px;
        color: #5a4e2d;
        font-size: 12px;
    }
</style>
