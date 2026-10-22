<script lang="ts">
    import type { HistoryEntry } from '$lib/history/historyEntries.js'
    import { entrySegments } from '$lib/history/entryText.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PieceIcon from './PieceIcon.svelte'

    let { entry, brief = false }: { entry: HistoryEntry; brief?: boolean } = $props()

    const session = getGameSession()

    const name = $derived(
        entry.playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(entry.playerId)
    )
    const segments = $derived(entrySegments(entry, brief))
</script>

<span
    ><span class="font-semibold">{name}</span
    >{#each segments as segment, index (index)}{#if segment.kind === 'text'}{segment.text}{:else if segment.kind === 'stack'}<span
                class="stack"><PieceIcon stack={segment.stack} size={15} /></span
            >{:else if segment.kind === 'player'}<span class="font-semibold"
                >{session.getPlayerName(segment.playerId)}</span
            >{:else}<span class="point">{session.notation.name(segment.coords)}</span
            >{/if}{/each}</span
>

<style>
    .stack {
        display: inline-flex;
        vertical-align: middle;
        margin: 0 1px;
    }

    .point {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.02em;
    }
</style>
