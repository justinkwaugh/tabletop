<script lang="ts">
    import type { MarbleColor } from '@tabletop/zertz'
    import type { HistoryEntry } from '$lib/history/historyEntries.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import MarbleIcon from './MarbleIcon.svelte'

    let { entry }: { entry: HistoryEntry } = $props()

    const session = getGameSession()

    const name = $derived(
        entry.playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(entry.playerId)
    )
</script>

{#snippet marbles(colors: readonly MarbleColor[])}
    <span class="inline-flex translate-y-[3px] gap-[2px]">
        {#each colors as color, index (index)}
            <MarbleIcon {color} size={14} />
        {/each}
    </span>
{/snippet}

<span>
    <span class="font-semibold">{name}</span>
    {#if entry.kind === 'placement'}
        placed {@render marbles([entry.color])}{#if entry.fromCaptures}
            from {name === 'You' ? 'your' : 'their'} captures{/if}{#if entry.removedRing}, removed a
            ring{/if}{#if entry.claimed.length > 0}
            and claimed {@render marbles(entry.claimed)}{/if}
    {:else}
        captured {@render marbles(entry.captured)}{#if entry.captured.length > 1}
            in {entry.captured.length} jumps{/if}
    {/if}
</span>
