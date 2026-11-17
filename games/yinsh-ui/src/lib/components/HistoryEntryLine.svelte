<script lang="ts">
    import { pointName } from '@tabletop/yinsh'
    import { CalledGameDescription } from '@tabletop/frontend-components'
    import type { HistoryEntry } from '$lib/history/historyEntries.js'
    import { entrySegments } from '$lib/history/entryText.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { entry, brief = false }: { entry: HistoryEntry; brief?: boolean } = $props()

    const session = getGameSession()

    const played = $derived(entry.kind === 'call' ? undefined : entry)
    const name = $derived.by(() => {
        if (played === undefined) return ''
        return played.playerId === session.myPlayer?.id
            ? 'You'
            : session.getPlayerName(played.playerId)
    })
    const segments = $derived(played ? entrySegments(played, brief) : [])
</script>

{#if entry.kind === 'call'}
    <span><CalledGameDescription action={entry.action} /></span>
{:else}
    <span
        ><span class="font-semibold">{name}</span
        >{#each segments as segment, index (index)}{#if segment.kind === 'text'}{segment.text}{:else if segment.kind === 'player'}<span
                    class="font-semibold">{session.getPlayerName(segment.playerId)}</span
                >{:else}<span class="point">{pointName(segment.coords)}</span>{/if}{/each}</span
    >
{/if}

<style>
    .point {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.02em;
    }
</style>
