<script lang="ts">
    import {
        INITIATIVE_PER_INFLUENCE,
        MAX_INITIATIVE_BID,
        choosesEscalationKept,
        escalationKeepCount,
        maxInitiativeBid
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { plural } from '$lib/utils/presentation.js'
    import EscalationChip from '../escalation/EscalationChip.svelte'

    const gameSession = getGameSession()
    const playerId = $derived(gameSession.myPlayerId ?? '')
    const player = $derived(gameSession.gameState.getPlayerState(playerId))
    const most = $derived(maxInitiativeBid(gameSession.gameState, playerId))
    const choices = $derived(Array.from({ length: most + 1 }, (_, influence) => influence))
    const choosing = $derived(choosesEscalationKept(player))
    const keepCount = $derived(escalationKeepCount(player.escalation.length))
    const ready = $derived(!choosing || gameSession.keptEscalation.length === keepCount)
</script>

<div class="sh-step">
    {#if most > 0}
        <p class="hint">
            Spend up to {MAX_INITIATIVE_BID} IP on your initiative roll, each adding {INITIATIVE_PER_INFLUENCE}%
            to it. Everyone declares at once; the rolls follow, and ties go to the better initiative
            before them.
        </p>
    {/if}
    {#if choosing}
        <p class="hint">
            After the rolls, half your escalation markers go back, rounded up. Choose the {plural(
                keepCount,
                'marker'
            )} to keep.
        </p>
        <div class="row">
            {#each player.escalation as marker, index (index)}
                <EscalationChip
                    {marker}
                    size={52}
                    selected={gameSession.keptEscalationMask[index]}
                    onclick={() => gameSession.toggleKeptEscalation(index)}
                />
            {/each}
        </div>
    {:else if player.escalation.length > 0}
        <p class="hint">
            After the rolls, half your escalation markers go back, rounded up: you keep {plural(
                keepCount,
                'marker'
            )}.
        </p>
    {/if}
    <div class="row">
        {#if most > 0}
            {#each choices as influence (influence)}
                <button
                    type="button"
                    disabled={!ready}
                    onclick={() => gameSession.declareInitiative(influence)}
                >
                    {influence === 0
                        ? 'No IP'
                        : `${influence} IP · +${influence * INITIATIVE_PER_INFLUENCE}%`}
                </button>
            {/each}
        {:else}
            <button
                type="button"
                class="primary"
                disabled={!ready}
                onclick={() => gameSession.declareInitiative(0)}
                >Keep {plural(keepCount, 'marker')}</button
            >
        {/if}
    </div>
</div>

<style>
    .row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
</style>
