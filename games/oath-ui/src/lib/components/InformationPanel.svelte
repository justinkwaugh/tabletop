<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { MachineState, endDieIsRolled } from '@tabletop/oath'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction } from '$lib/model/actionDescription.js'
    import { heldTurnOf } from '$lib/model/campaignTurn.js'

    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)

    const PHASE_NAMES: Record<MachineState, string> = {
        [MachineState.Setup]: 'Setup',
        [MachineState.WakePhase]: 'Wake Phase',
        [MachineState.ActPhase]: 'Act Phase',
        [MachineState.RestPhase]: 'Rest Phase',
        [MachineState.Searching]: 'Searching — resolve the draw',
        [MachineState.CampaignPlans]: 'Campaign — the defending side uses battle plans',
        [MachineState.CampaignSacrifice]: 'Campaign — choose a sacrifice',
        [MachineState.CampaignDefeat]: 'Campaign — the defending side chooses its losses',
        [MachineState.CampaignVictory]: 'Campaign — take the spoils',
        [MachineState.OathkeeperChoice]: 'Oathkeeper — choose a successor',
        [MachineState.ConsentRequest]: 'A question — an answer is owed',
        [MachineState.PowerQuestion]: 'A card asks — an answer is owed',
        [MachineState.EndOfGame]: 'Game over'
    }

    // R-X.3 — `GameSession.undoableAction` stops at the first action that set
    // `revealsInfo`. With a pick in progress, Undo steps back through the picks first.
    let undoable = $derived(gameSession.isViewingHistory ? undefined : gameSession.undoableAction)
    let steppingBack = $derived(!gameSession.isViewingHistory && gameSession.hasManualDraft)
    let busy = $derived(gameSession.busy)

    function undo() {
        if (!undoable && !steppingBack) return
        void gameSession.undo()
    }

    let phase = $derived(PHASE_NAMES[gameState.machineState])
    let activePlayerId = $derived(gameState.activePlayerIds[0])
    let heldTurn = $derived(heldTurnOf(gameState))

    // R-3.3 — from round 5 every Rest could end the game.
    let endDieLive = $derived(endDieIsRolled(gameState))
</script>

<div
    class="info mb-2 rounded-lg bg-stone-900/70 border border-stone-700 px-3 py-1.5 text-stone-100"
>
    <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {#if heldTurn}
            <span class="text-base font-semibold">
                <PlayerName playerId={heldTurn.campaignerId} />
                {heldTurn.campaignerId === gameSession.myPlayer?.id ? 'are' : 'is'} campaigning out of
                turn
            </span>
            <span class="text-xs text-stone-300">
                <PlayerName playerId={heldTurn.turnPlayerId} possessive /> turn is held
            </span>
        {:else if activePlayerId}
            <span class="text-base font-semibold">
                <!-- `PlayerName` prints "You" for the viewer. -->
                {#if activePlayerId === gameSession.myPlayer?.id}
                    Your turn
                {:else}
                    <PlayerName playerId={activePlayerId} />'s turn
                {/if}
            </span>
        {/if}
        <span class="text-sm text-stone-300">{phase}</span>
        {#if endDieLive}
            <span class="text-xs rounded bg-rose-900/70 text-rose-100 px-2 py-0.5"
                >end die live</span
            >
        {/if}
        {#if steppingBack}
            <button
                class="ml-auto shrink-0 rounded bg-stone-700 hover:bg-stone-600 disabled:opacity-40
                       px-2 py-0.5 text-xs font-semibold"
                disabled={busy}
                title="Steps back through the picks not yet sent, as Back does."
                onclick={undo}
            >
                Undo — <span class="font-normal">your last pick</span>
            </button>
        {:else if undoable}
            <button
                class="ml-auto shrink-0 max-w-[22rem] truncate rounded bg-stone-700
                       hover:bg-stone-600 disabled:opacity-40 px-2 py-0.5
                       text-xs font-semibold"
                disabled={busy}
                title="Reverses the last action for everyone (R-X.3). Not the same as Back."
                onclick={undo}
            >
                Undo — <span class="font-normal"
                    >{describeAction(
                        undoable,
                        gameSession.historyNames,
                        gameSession.myPlayer?.id
                    )}</span
                >
            </button>
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
