<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { CalledGameEnding } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    const winner = $derived.by(() => {
        const [first] = session.gameState.winningPlayerIds
        assertExists(first, 'A finished game names its winner')
        return first
    })
</script>

<div
    class="flex min-h-[50px] flex-col items-center justify-center px-3 py-1 text-center text-(--hex-ink)"
>
    {#if session.gameCall}
        <CalledGameEnding class="text-[18px] tracking-[0.02em]" />
    {:else}
        <div class="text-[22px] font-semibold tracking-[0.06em]">
            {winner === session.myPlayer?.id ? 'You win' : `${session.getPlayerName(winner)} wins`}
        </div>
    {/if}
</div>
