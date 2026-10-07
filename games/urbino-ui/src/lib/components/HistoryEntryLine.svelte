<script lang="ts">
    import type { HistoryEntry } from '$lib/history/historyEntries.js'
    import { squareName } from '$lib/board/geometry.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import PieceIcon from './PieceIcon.svelte'
    import PawnIcon from './PawnIcon.svelte'

    let { entry, viewerId }: { entry: HistoryEntry; viewerId: string | undefined } = $props()

    const session = getGameSession()

    function nameOf(playerId: string): string {
        return playerId === viewerId ? 'You' : session.getPlayerName(playerId)
    }
</script>

{#snippet square(pos: number)}
    <span class="urbino-display text-[0.85em] tracking-wide">{squareName(pos)}</span>
{/snippet}

<span class="inline">
    <span class="font-semibold">{nameOf(entry.playerId)}</span>
    {#if entry.kind === 'architect'}
        placed architect {entry.architectNumber} on {@render square(entry.position)}
        <span class="inline-block align-[-4px]"><PawnIcon size={18} /></span>
    {:else if entry.kind === 'firstPlayer'}
        {#if entry.startingPlayerId === entry.playerId}
            chose to build first
        {:else}
            chose <span class="font-semibold">{nameOf(entry.startingPlayerId)}</span> to build first
        {/if}
    {:else}
        {#if entry.move}
            moved architect {entry.move.architectNumber} to {@render square(entry.move.position)}{#if entry.build || entry.passed},
                then{/if}
        {/if}
        {#if entry.build}
            built a {entry.build.buildingType} on {@render square(entry.build.position)}
            <span class="inline-block align-[-5px]">
                <PieceIcon
                    buildingType={entry.build.buildingType}
                    color={session.colors.getPlayerUiColor(entry.playerId)}
                    buildingStyle={session.buildingStyle}
                    size={20}
                />
            </span>
        {:else if entry.passed}
            had nowhere to build and passed
        {:else if entry.conceded}
            conceded
        {:else if !entry.move}
            is taking a turn
        {/if}
    {/if}
</span>
