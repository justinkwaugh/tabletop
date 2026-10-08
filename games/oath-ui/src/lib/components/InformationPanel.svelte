<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { turnBarOf } from '$lib/model/turnBar.js'

    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)

    // R-X.3 — `GameSession.undoableAction` stops at the first action that set `revealsInfo`.
    let undoable = $derived(gameSession.isViewingHistory ? undefined : gameSession.undoableAction)
    let pickInProgress = $derived(!gameSession.isViewingHistory && gameSession.hasManualDraft)
    let undoOffered = $derived(pickInProgress || undoable !== undefined)
    let busy = $derived(gameSession.busy)

    let bar = $derived(turnBarOf(gameState))
    let clock = $derived(`${bar.roll ? 'roll' : 'turn'}${bar.paused ? ' is paused' : ''}`)
</script>

<div
    class="info mb-2 rounded-lg bg-oath-surface border border-oath-frame px-3 py-1.5 text-oath-text"
>
    <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {#if bar.playerId}
            <span class="text-base font-semibold">
                <!-- `PlayerName` prints "You" for the viewer. -->
                {#if bar.playerId === gameSession.myPlayer?.id}
                    Your {clock}
                {:else}
                    <PlayerName playerId={bar.playerId} />'s {clock}
                {/if}
            </span>
            <span class="text-sm text-oath-text-muted">{bar.phase}</span>
        {:else}
            <span class="text-base font-semibold">{bar.phase}</span>
        {/if}
        {#if undoOffered}
            <button
                type="button"
                class="ml-auto shrink-0 self-center rounded-lg bg-oath-primary text-oath-primary-text
                       border-[1.5px] border-oath-primary-border hover:bg-oath-primary-hover disabled:opacity-40 px-3 py-1.5 text-sm font-semibold"
                disabled={busy}
                onclick={() => gameSession.undo()}>Undo</button
            >
        {/if}
    </div>
</div>

<style>
    /* A phone held sideways: one slim line, so the Act Phase's buttons get the height. */
    @media (max-height: 520px) and (orientation: landscape) {
        .info {
            margin-bottom: 4px;
            padding-top: 2px;
            padding-bottom: 2px;
        }
    }
</style>
