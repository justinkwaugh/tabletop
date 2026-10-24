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
    import InitiativeStep from './steps/InitiativeStep.svelte'
    import ProductionStep from './steps/ProductionStep.svelte'
    import ConversionStep from './steps/ConversionStep.svelte'
    import EventPlacementStep from './steps/EventPlacementStep.svelte'
    import HomesteadersStep from './steps/HomesteadersStep.svelte'
    import RewardSettlementsStep from './steps/RewardSettlementsStep.svelte'
    import AssignGoodsStep from './steps/AssignGoodsStep.svelte'
    import DemandChoiceStep from './steps/DemandChoiceStep.svelte'
    import RewardGoodsStep from './steps/RewardGoodsStep.svelte'
    import SurveyChoice from './steps/SurveyChoice.svelte'
    import TerraformStep from './steps/TerraformStep.svelte'
    import TerraformChoice from './steps/TerraformChoice.svelte'
    import PactList from './steps/PactList.svelte'
    import WaitingPanel from './steps/WaitingPanel.svelte'
    import DrawCardStep from './steps/DrawCardStep.svelte'
    import EconomicTileStep from './steps/EconomicTileStep.svelte'
    import GrowthBaseStep from './steps/GrowthBaseStep.svelte'

    const gameSession = getGameSession()
    const machineState = $derived(gameSession.gameState.machineState)
</script>

<div class="panel">
    {#if !gameSession.canAct}
        {#if gameSession.currentPhase}
            <StepTracker />
        {/if}
        <!-- A hotseat Player waiting on another's Branch may still answer a pact naming them. -->
        <PactList />
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
        {:else if gameSession.actingPhase === TurnPhase.Initiative}
            <InitiativeStep />
        {:else if gameSession.actingPhase === TurnPhase.BaseProduction}
            <ProductionStep />
        {:else if gameSession.actingPhase === TurnPhase.TradeGoods}
            <AssignGoodsStep />
        {/if}
    {:else if machineState === MachineState.ChoosingSurveyWorld}
        <SurveyChoice />
    {:else if machineState === MachineState.Terraforming}
        <TerraformStep />
    {:else if machineState === MachineState.ChoosingTerraformWorld}
        <TerraformChoice />
    {:else if machineState === MachineState.ConvertingSettlements}
        <ConversionStep />
    {:else if machineState === MachineState.ChoosingGrowthBase}
        <GrowthBaseStep />
    {:else if machineState === MachineState.DrawingCards}
        <DrawCardStep />
    {:else if machineState === MachineState.EconomicPhase}
        <EconomicTileStep />
    {:else if machineState === MachineState.PlacingRewardSettlements}
        <RewardSettlementsStep />
    {:else if machineState === MachineState.PlacingRewardGoods}
        <RewardGoodsStep />
    {:else if machineState === MachineState.ChoosingDemand}
        <DemandChoiceStep />
    {:else if machineState === MachineState.PlacingEvent}
        <EventPlacementStep />
    {:else if machineState === MachineState.PlacingHomesteaders}
        <HomesteadersStep />
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
