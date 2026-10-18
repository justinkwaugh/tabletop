<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import { MachineState, isCampaign, isEvenDecade } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PHASE_LABELS } from '$lib/utils/presentation.js'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const status = $derived.by(() => {
        if (gameSession.isViewingHistory) return 'HISTORY'
        if (gameState.result) return 'END OF GAME'
        if (gameState.machineState === MachineState.ChoosingFactions) return 'CHOOSE FACTIONS'
        if (gameState.machineState === MachineState.PlacingStartingBases && gameSession.canAct)
            return 'PLACE YOUR STARTING BASE'
        if (gameState.machineState === MachineState.Terraforming) return 'TERRAFORMING'
        if (gameState.machineState === MachineState.ConvertingSettlements && gameSession.canAct)
            return 'CONVERSION'
        if (gameState.machineState === MachineState.PlacingEvent && gameSession.canAct)
            return 'PLACE THE EVENT'
        if (gameState.machineState === MachineState.PlacingHomesteaders && gameSession.canAct)
            return 'HOMESTEADERS'
        if (gameState.machineState === MachineState.PlacingRewardSettlements && gameSession.canAct)
            return 'PLACE SETTLEMENTS'
        if (gameState.machineState === MachineState.ResolvingAnomalies) return 'ANOMALIES'
        if (
            gameState.machineState === MachineState.ChoosingSurveyWorld ||
            gameState.machineState === MachineState.ResolvingSurveys
        )
            return 'SURVEYS'
        if (gameSession.actingPhase) {
            return PHASE_LABELS[gameSession.actingPhase].toUpperCase()
        }
        return undefined
    })
</script>

<div class="header">
    <div class="year">
        <span class="year-number">DECADE {gameState.year}</span>
        {#if isEvenDecade(gameState.year) && !isCampaign(gameState)}
            <span
                class="even"
                title={gameState.scenarioDefinition().terraforming
                    ? 'Even decade: income and terraforming'
                    : 'Even decade: income'}>EVEN DECADE</span
            >
        {/if}
    </div>
    <div class="status">
        {#key status}
            <div in:fade={{ duration: 200 }}>
                {#if status}
                    {status}
                {:else if !gameSession.isMyTurn && gameState.activePlayerIds.length === 1}
                    <span class="inline-flex gap-x-1">
                        WAITING FOR
                        <PlayerName
                            playerId={gameState.activePlayerIds[0]}
                            capitalization="uppercase"
                        />
                    </span>
                {:else if !gameSession.isMyTurn}
                    WAITING FOR OTHER PLAYERS
                {/if}
            </div>
        {/key}
    </div>
    <div class="actions">
        {#if gameSession.hasManualSelection() || gameSession.undoableAction}
            <button type="button" onclick={() => gameSession.undo()} class="header-button"
                >UNDO</button
            >
        {/if}
    </div>
</div>

<style>
    .header {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 12px;
        height: 44px;
        padding: 0 16px;
        border-bottom: 1px solid #1e2b44;
        color: #dbe7f5;
        letter-spacing: 0.08em;
        font-size: 17px;
    }

    .year {
        display: flex;
        align-items: baseline;
        gap: 8px;
    }

    .year-number {
        font-size: 22px;
        font-weight: 700;
        color: #f2c94c;
        white-space: nowrap;
    }

    .even {
        font-size: 11px;
        color: #7fd3ff;
        border: 1px solid #2a5878;
        border-radius: 999px;
        padding: 0 6px;
    }

    .actions {
        justify-self: end;
    }

    .header-button {
        border-radius: 0.5rem;
        padding: 0.25rem 0.5rem;
        color: #dbe7f5;
    }

    .header-button:hover {
        background: rgba(127, 211, 255, 0.12);
    }

    @media (max-width: 639px) {
        .header {
            gap: 8px;
            height: 32px;
            padding: 0 8px;
            font-size: 14px;
            letter-spacing: 0.04em;
        }

        .year-number {
            font-size: 16px;
        }
    }
</style>
