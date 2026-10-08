<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries, type HistoryEntry } from '$lib/utils/historyEntries.js'
    import StoryLine from './ui/StoryLine.svelte'

    const gameSession = getGameSession()
    const entries = $derived(
        historyEntries(
            gameSession.actions.toSorted((a, b) => (a.index ?? 0) - (b.index ?? 0))
        ).toReversed()
    )

    async function jump(index: number) {
        await gameSession.history.goToActionIndex(index)
    }

    function entryKey(entry: HistoryEntry): string {
        return entry.kind === 'round' || entry.kind === 'guildMaster'
            ? `${entry.kind}-${entry.index}`
            : `${entry.kind}-${entry.firstIndex}`
    }
</script>

<div class="flex flex-col gap-1.5 pb-3 text-[#3f2a16]">
    {#if gameSession.game.finishedAt}
        <div class="interstitial">The voyage is over</div>
    {/if}
    {#each entries as entry (entryKey(entry))}
        {#if entry.kind === 'round'}
            <button class="interstitial" onclick={() => jump(entry.index)}
                >Round {entry.round}</button
            >
        {:else if entry.kind === 'guildMaster'}
            <div class="entry guild-master"><StoryLine story={entry.line} /></div>
        {:else if entry.kind === 'turn'}
            <button
                class="entry text-left"
                style="border-left-color:{gameSession.colors.getPlayerUiColor(entry.playerId)}"
                onclick={() => jump(entry.lastIndex)}
            >
                <div class="heading"><PlayerName playerId={entry.playerId} possessive /> turn</div>
                {#each entry.lines as line, index (index)}
                    <div class="line"><StoryLine story={line} /></div>
                {/each}
                {#if entry.lines.length === 0}
                    <div class="line italic opacity-70">stays put{entry.complete ? '' : '…'}</div>
                {/if}
            </button>
        {:else}
            <div class="entry">
                <div class="heading">
                    {entry.kind === 'setup'
                        ? 'Founding the first offices'
                        : 'Auction for the turn order'}
                </div>
                {#each entry.lines as line, index (index)}
                    <div class="line"><StoryLine story={line} /></div>
                {/each}
            </div>
        {/if}
    {/each}
</div>

<style>
    .interstitial {
        margin: 0.4rem 0 0.1rem;
        text-align: center;
        font-family: 'IM Fell English SC', serif;
        font-size: 1.1rem;
        letter-spacing: 0.06em;
        border-top: 1px solid #8a6a3c;
        border-bottom: 1px solid #8a6a3c;
        background: rgba(244, 234, 208, 0.6);
    }

    .entry {
        border: 1px solid #c9b48a;
        border-left: 5px solid #8a6a3c;
        border-radius: 4px;
        background: #f6edd5;
        padding: 0.3rem 0.5rem;
        font-size: 0.875rem;
    }

    button.entry:hover {
        background: #efe2bf;
    }

    .guild-master {
        border-left-color: #2b211b;
        font-style: italic;
    }

    .heading {
        font-family: 'IM Fell English SC', serif;
        font-size: 1rem;
    }

    .line {
        line-height: 1.5;
    }
</style>
