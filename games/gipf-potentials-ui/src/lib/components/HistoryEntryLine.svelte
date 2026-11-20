<script lang="ts">
    import { CalledGameDescription } from '@tabletop/frontend-components'
    import type { HistoryEntry } from '$lib/history/historyEntries.js'
    import { entrySegments } from '$lib/history/entryText.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PieceIcon from './PieceIcon.svelte'

    let { entry, brief = false }: { entry: HistoryEntry; brief?: boolean } = $props()

    const session = getGameSession()

    const move = $derived(entry.kind === 'call' ? undefined : entry)
    const name = $derived.by(() => {
        if (move === undefined) return ''
        return move.playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(move.playerId)
    })
    const segments = $derived(move ? entrySegments(move, brief) : [])
</script>

{#if entry.kind === 'call'}
    <span><CalledGameDescription action={entry.action} /></span>
{:else}
    {@const color = session.gameState.getPlayerState(entry.playerId).color}
    <span
        ><span class="font-semibold">{name}</span
        >{#each segments as segment, index (index)}{#if segment.kind === 'text'}{segment.text}{:else if segment.kind === 'piece'}<span
                    class="piece"><PieceIcon {color} discs={segment.discs} size={15} /></span
                >{:else}<span class="point">{session.notation.name(segment.coords)}</span
                >{/if}{/each}</span
    >
{/if}

<style>
    .piece {
        display: inline-flex;
        transform: translateY(2px);
    }

    .point {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.02em;
    }

    .piece {
        margin: 0 1px;
    }
</style>
