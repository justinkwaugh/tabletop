<script lang="ts">
    import { OATHKEEPER_GOALS } from '@tabletop/oath'
    import { goalText } from '$lib/model/names.js'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-2.11.b, R-2.11-H1 — opens on anyone's turn.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let busy = $derived(gameSession.busy)

    let pending = $derived(gameState.pendingOathkeeperChoice)
    let isMine = $derived(
        !!gameSession.myPlayer && pending?.holderPlayerId === gameSession.myPlayer.id
    )

    function blockedBecause(candidateId: string): string | undefined {
        return gameSession.reasonCannotChooseOathkeeper(candidateId)
    }
</script>

<div>
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-heading mb-2">
        The Oathkeeper title
    </h3>

    {#if !pending}
        <p class="text-sm text-oath-text-muted">No title is waiting to be settled.</p>
    {:else if !isMine}
        <p class="text-sm text-oath-text-muted">
            Waiting for <PlayerName playerId={pending.holderPlayerId} /> to choose who takes the Oathkeeper
            title.
        </p>
    {:else}
        <p class="text-sm mb-1">
            You no longer {goalText(OATHKEEPER_GOALS[gameState.oathType])}, and more than one player
            now does. Choose who takes the Oathkeeper title.
        </p>
        <p class="mb-2 text-[11px] text-oath-text-muted leading-snug">
            You cannot keep it, and you cannot decline — the rules give the outgoing holder the
            choice, not a veto.
        </p>

        <div class="flex flex-col gap-1">
            {#each pending.candidates as candidateId (candidateId)}
                {@const why = blockedBecause(candidateId)}
                <button
                    class="rounded border px-2 py-1 text-sm text-left {why
                        ? 'border-oath-divider bg-oath-surface opacity-55'
                        : 'border-oath-frame bg-oath-surface-raised hover:border-oath-accent'}"
                    disabled={busy || !!why}
                    onclick={() => gameSession.resolveOathkeeper(candidateId)}
                >
                    Give it to {gameSession.getPlayerName(candidateId)}
                    {#if why}
                        <span class="block text-[11px] text-oath-text-muted">{why}</span>
                    {/if}
                </button>
            {/each}
        </div>
    {/if}
</div>
