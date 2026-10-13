<script lang="ts">
    import { MachineState, TurnPhase } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import LastActionDescription from './LastActionDescription.svelte'
    import FactionPicker from './steps/FactionPicker.svelte'
    import StartingBasePicker from './steps/StartingBasePicker.svelte'
    import StepTracker from './steps/StepTracker.svelte'
    import BuildStep from './steps/BuildStep.svelte'
    import CargoStep from './steps/CargoStep.svelte'
    import MovementStep from './steps/MovementStep.svelte'
    import ExplorationStep from './steps/ExplorationStep.svelte'
    import DevelopmentStep from './steps/DevelopmentStep.svelte'
    import SurveyChoice from './steps/SurveyChoice.svelte'
    import TerraformStep from './steps/TerraformStep.svelte'
    import TerraformChoice from './steps/TerraformChoice.svelte'
    import WaitingPanel from './steps/WaitingPanel.svelte'

    const gameSession = getGameSession()
    const machineState = $derived(gameSession.gameState.machineState)
</script>

<div class="panel">
    {#if !gameSession.canAct}
        {#if gameSession.currentPhase}
            <StepTracker />
        {/if}
        <WaitingPanel />
    {:else if machineState === MachineState.ChoosingFactions}
        <FactionPicker />
    {:else if machineState === MachineState.PlacingStartingBases}
        <StartingBasePicker />
    {:else if gameSession.actingPhase}
        <StepTracker />
        {#if gameSession.actingPhase === TurnPhase.Build}
            <BuildStep />
        {:else if gameSession.actingPhase === TurnPhase.Cargo}
            <CargoStep />
        {:else if gameSession.actingPhase === TurnPhase.Movement}
            <MovementStep />
        {:else if gameSession.actingPhase === TurnPhase.Exploration}
            <ExplorationStep />
        {:else if gameSession.actingPhase === TurnPhase.Development}
            <DevelopmentStep />
        {/if}
    {:else if machineState === MachineState.ChoosingSurveyWorld}
        <SurveyChoice />
    {:else if machineState === MachineState.Terraforming}
        <TerraformStep />
    {:else if machineState === MachineState.ChoosingTerraformWorld}
        <TerraformChoice />
    {:else}
        <LastActionDescription />
    {/if}
</div>

<style>
    .panel {
        display: flex;
        flex-direction: column;
        gap: 8px;
        color: #dbe7f5;
        min-width: min(640px, 100%);
    }
</style>
