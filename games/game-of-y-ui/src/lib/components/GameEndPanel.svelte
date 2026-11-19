<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { CalledGameEnding } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    const winner = $derived.by(() => {
        const [first] = session.gameState.winningPlayerIds
        assertExists(first, 'A Y names its winner')
        return first
    })
</script>

<div class="flex flex-col items-center gap-1 px-3 py-2 text-center text-(--y-ink)">
    {#if session.gameCall}
        <CalledGameEnding class="text-[18px] tracking-[0.02em]" />
    {:else}
        <div class="text-[22px] font-semibold tracking-[0.06em]">
            {winner === session.myPlayer?.id ? 'You win' : `${session.getPlayerName(winner)} wins`}
        </div>
        <div class="text-[15px] text-(--y-ink-quiet)">
            A chain of {session.colorOf(winner)} joins all three sides
        </div>
    {/if}
</div>
