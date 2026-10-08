<script lang="ts">
    import { FINAL_ROUND } from '@tabletop/oath'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import WaitingOn from '$lib/components/WaitingOn.svelte'
    import { endDieStakes } from '$lib/model/endOfRound.js'

    // R-3.3 — the round has ended with the Empire holding the title; only the Chancellor rolls.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let viewerId = $derived(gameSession.myPlayer?.id)
    let chancellorId = $derived(gameState.chancellorId())
    let rolls = $derived(viewerId === chancellorId && gameSession.isMyTurn)
    let stakes = $derived(endDieStakes(gameState, viewerId))
    let busy = $derived(gameSession.busy)
</script>

<div>
    {#if stakes}
        <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-heading mb-1">
            End of round {stakes.round} of {FINAL_ROUND}
        </h3>
        {#if rolls}
            <p class="text-sm text-oath-text-muted">
                The Empire holds the Oathkeeper title, so you roll the end die.
            </p>
        {:else}
            <WaitingOn />
        {/if}
        <p class="mt-1 text-sm">
            A <b class="text-oath-danger">{stakes.threshold}</b> ends the game:
            {#if stakes.winnerId === viewerId}
                you win {stakes.as}.
            {:else}
                <PlayerName playerId={stakes.winnerId} /> wins {stakes.as}.
            {/if}
        </p>
        {#if rolls}
            <button
                class="mt-2 w-full rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                       border-[1.5px] border-oath-primary-border px-2 py-1.5 text-sm font-semibold"
                disabled={busy}
                onclick={() => gameSession.rollEndDie()}
            >
                Roll the end die
            </button>
            <p class="mt-1 text-xs text-oath-text-muted">The roll can't be undone.</p>
        {/if}
    {/if}
</div>
