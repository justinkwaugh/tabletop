<script lang="ts">
    import { EndReason } from '@tabletop/zertz'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { victoryOf } from '$lib/model/victory.js'
    import MarbleIcon from './MarbleIcon.svelte'

    const session = getGameSession()

    const winnerId = $derived(session.gameState.winningPlayerIds[0])
    const victory = $derived(victoryOf(session.gameState))

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    const verdict = $derived(
        winnerId === session.myPlayer?.id ? 'You win' : `${nameOf(winnerId)} wins`
    )
</script>

<div class="flex flex-col items-center gap-1 px-3 py-2 text-center text-(--zertz-ink)">
    <div class="text-[22px] font-semibold tracking-[0.06em]">{verdict}</div>
    {#if victory}
        <div class="flex items-center gap-2 text-[15px] text-(--zertz-ink-quiet)">
            {#if victory.reason === EndReason.FullBoard}
                by filling the last ring on the board
            {:else if victory.reason === EndReason.NoMarbles}
                {nameOf(victory.loserId)} had no marble to place
            {:else if 'color' in victory}
                with {victory.count}
                <MarbleIcon color={victory.color} size={16} />
                {victory.color} marbles
            {:else}
                with {victory.eachColor} marbles of each colour
            {/if}
        </div>
    {/if}
</div>
