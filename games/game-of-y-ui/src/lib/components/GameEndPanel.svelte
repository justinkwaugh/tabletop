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

<div class="ending">
    {#if session.gameCall}
        <CalledGameEnding class="text-[18px] tracking-[0.02em]" />
    {:else}
        <span class="winner">
            {winner === session.myPlayer?.id ? 'You win' : `${session.getPlayerName(winner)} wins`}
        </span>
    {/if}
</div>

<style>
    .ending {
        display: flex;
        justify-content: center;
        min-width: 0;
        max-width: 100%;
    }

    .winner {
        font-size: 20px;
        font-weight: 600;
        letter-spacing: 0.06em;
        white-space: nowrap;
        color: var(--y-ink);
    }
</style>
