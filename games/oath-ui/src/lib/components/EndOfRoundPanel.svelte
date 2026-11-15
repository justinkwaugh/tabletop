<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import EndDieStakes from '$lib/components/EndDieStakes.svelte'
    import EndDieValue from '$lib/components/EndDieValue.svelte'
    import WaitingOn from '$lib/components/WaitingOn.svelte'
    import { endDieStakes } from '$lib/model/endOfRound.js'

    // R-3.3 — the round has ended with the Empire holding the title; only the Chancellor rolls.
    // `rolled`: the die is rolled and Squalid District's ruler is asked to move it; everyone else
    // sees the roll and who it waits on.
    let { rolled }: { rolled?: number } = $props()

    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let viewerId = $derived(gameSession.myPlayer?.id)
    let chancellorId = $derived(gameState.chancellorId())
    let rolls = $derived(rolled === undefined && viewerId === chancellorId && gameSession.isMyTurn)
    let stakes = $derived(endDieStakes(gameState, viewerId))
    let busy = $derived(gameSession.busy)
</script>

<div>
    {#if stakes}
        <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-heading mb-1">End die</h3>
        {#if !rolls && rolled === undefined}
            <WaitingOn />
        {/if}
        <p class="mt-1 text-sm">
            <EndDieStakes {stakes} {viewerId} />
        </p>
        {#if rolled !== undefined}
            <p class="mt-1 text-sm">Rolled a <EndDieValue value={rolled} />.</p>
            <div class="mt-1"><WaitingOn /></div>
        {/if}
        {#if rolls}
            <button
                class="mt-2 rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                       border-[1.5px] border-oath-primary-border px-3 py-1.5 text-sm font-semibold max-sm:min-h-11"
                disabled={busy}
                onclick={() => gameSession.rollEndDie()}
            >
                Roll the end die
            </button>
        {/if}
    {/if}
</div>
