<script lang="ts">
    import { pointName } from '@tabletop/yinsh'
    import type { HistoryEntry } from '$lib/history/historyEntries.js'
    import { entrySegments } from '$lib/history/entryText.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { entry, brief = false }: { entry: HistoryEntry; brief?: boolean } = $props()

    const session = getGameSession()

    const name = $derived(
        entry.playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(entry.playerId)
    )
    const segments = $derived(entrySegments(entry, brief))
</script>

<span
    ><span class="font-semibold">{name}</span
    >{#each segments as segment, index (index)}{#if segment.kind === 'text'}{segment.text}{:else if segment.kind === 'player'}<span
                class="font-semibold">{session.getPlayerName(segment.playerId)}</span
            >{:else}<span class="point">{pointName(segment.coords)}</span>{/if}{/each}</span
>

<style>
    .point {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.02em;
    }
</style>
