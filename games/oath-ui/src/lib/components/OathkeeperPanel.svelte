<script lang="ts">
    import { OATHKEEPER_GOALS, Goal } from '@tabletop/oath'
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

    const GOAL_TEXT: Record<Goal, string> = {
        [Goal.MostSites]: 'rule the most sites',
        [Goal.PeoplesFavor]: "hold the Banner of the People's Favor",
        [Goal.MostRelicsAndBanners]: 'hold the most relics and banners',
        [Goal.DarkestSecret]: 'hold the Banner of the Darkest Secret'
    }

    function blockedBecause(candidateId: string): string | undefined {
        return gameSession.reasonCannotChooseOathkeeper(candidateId)
    }
</script>

<div class="rounded-lg bg-stone-900/70 border border-amber-500/40 px-3 py-2 text-stone-100">
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-amber-200/80 mb-2">
        The Oathkeeper title
    </h3>

    {#if !pending}
        <p class="text-sm text-stone-400">No title is waiting to be settled.</p>
    {:else if !isMine}
        <p class="text-sm text-stone-300">
            Waiting for <PlayerName playerId={pending.holderPlayerId} /> to choose who takes the Oathkeeper
            title.
        </p>
    {:else}
        <p class="text-sm mb-1">
            You no longer {GOAL_TEXT[OATHKEEPER_GOALS[gameState.oathType]]}, and more than one
            player now does. Choose who takes the Oathkeeper title.
        </p>
        <p class="mb-2 text-[11px] text-stone-400 leading-snug">
            You cannot keep it, and you cannot decline — the rules give the outgoing holder the
            choice, not a veto.
        </p>

        <div class="flex flex-col gap-1">
            {#each pending.candidates as candidateId (candidateId)}
                {@const why = blockedBecause(candidateId)}
                <button
                    class="rounded border px-2 py-1 text-sm text-left {why
                        ? 'border-stone-800 bg-stone-900/40 opacity-55'
                        : 'border-amber-500/40 bg-stone-800/60 hover:border-amber-300'}"
                    disabled={busy || !!why}
                    onclick={() => gameSession.resolveOathkeeper(candidateId)}
                >
                    Give it to {gameSession.getPlayerName(candidateId)}
                    {#if why}
                        <span class="block text-[11px] text-stone-400">{why}</span>
                    {/if}
                </button>
            {/each}
        </div>
    {/if}
</div>
