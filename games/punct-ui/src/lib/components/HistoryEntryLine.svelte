<script lang="ts">
    import { spaceLabel } from '$lib/board/coordinates.js'
    import type { HistoryEntry } from '$lib/history/historyEntries.js'
    import { entrySegments } from '$lib/history/entryText.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PieceIcon from './PieceIcon.svelte'

    let { entry, brief = false }: { entry: HistoryEntry; brief?: boolean } = $props()

    const session = getGameSession()

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    const color = $derived(session.gameState.getPlayerState(entry.playerId).color)
    const segments = $derived(entrySegments(entry, brief))
</script>

<span
    ><span class="font-semibold">{nameOf(entry.playerId)}</span
    >{#each segments as segment, index (index)}{#if segment.kind === 'text'}{segment.text}{:else if segment.kind === 'piece'}<span
                class="piece"><PieceIcon {color} kind={segment.piece} scale={0.1} /></span
            >{:else if segment.kind === 'player'}<span class="font-semibold"
                >{nameOf(segment.playerId)}</span
            >{:else}<span class="point">{spaceLabel(segment.coords)}</span>{/if}{/each}</span
>

<style>
    .piece {
        display: inline-flex;
        margin: 0 1px;
        transform: translateY(2px);
    }

    .point {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.02em;
    }
</style>
