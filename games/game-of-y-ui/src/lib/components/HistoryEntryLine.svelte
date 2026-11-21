<script lang="ts">
    import { CalledGameDescription } from '@tabletop/frontend-components'
    import type { HistoryEntry } from '$lib/history/historyEntries.js'
    import { entrySegments } from '$lib/history/entryText.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { entry, brief = false }: { entry: HistoryEntry; brief?: boolean } = $props()

    const session = getGameSession()

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }
</script>

{#if entry.kind === 'call'}
    <CalledGameDescription action={entry.action} />
{:else}<span
        ><span class="font-semibold">{nameOf(entry.playerId)}</span
        >{#each entrySegments(entry, brief) as segment, index (index)}{#if segment.kind === 'text'}{segment.text}{:else}<span
                    class="point">{segment.point}</span
                >{/if}{/each}</span
    >{/if}

<style>
    .point {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.02em;
    }
</style>
