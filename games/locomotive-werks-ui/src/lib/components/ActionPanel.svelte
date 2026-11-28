<script lang="ts">
    import { MachineState } from '@tabletop/locomotive-werks'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PhaseTrack from './PhaseTrack.svelte'
    import WaitingView from './WaitingView.svelte'
    import RoundReview from './RoundReview.svelte'
    import CapacityPlanner from './CapacityPlanner.svelte'
    import DevelopChoices from './DevelopChoices.svelte'
    import SaleList from './SaleList.svelte'
    import { locomotiveData } from '@tabletop/locomotive-werks'

    const gameSession = getGameSession()

    const state = $derived(gameSession.gameState)
    const machineState = $derived(state.machineState)
    const plannedIncome = $derived(
        gameSession.plannedShipments.reduce((sum, shipment) => sum + shipment.income, 0)
    )
    const firstSale = $derived(gameSession.buyAndShip && state.sellingRound?.number === 1)
    const doneLabel = $derived(
        `${firstSale ? 'Done, on to selling' : 'Done buying'}${
            gameSession.plannedSpend > 0 ? ` · $${gameSession.plannedSpend}` : ''
        }`
    )
</script>

<div class="panel">
    <PhaseTrack review={gameSession.roundReview} />
    {#if gameSession.roundReview}
        <RoundReview review={gameSession.roundReview} />
    {:else if gameSession.isViewingHistory || !gameSession.canAct}
        <WaitingView />
    {:else if machineState === MachineState.Developing}
        {@const chosen = gameSession.chosenLocomotive}
        <p class="prompt">
            {#if gameSession.developTargets.length > 0}
                Choose a locomotive to develop. You have ${gameSession.myCash}.
            {:else}
                You can afford no locomotive to develop.
            {/if}
        </p>
        <DevelopChoices />
        {#if chosen}
            <p class="note">Developing it opens a werk with one unit and cannot be undone.</p>
        {/if}
        <div class="row">
            {#if chosen}
                <button type="button" class="primary" onclick={() => gameSession.develop(chosen)}
                    >Develop · ${locomotiveData(chosen).developmentCost}</button
                >
            {/if}
            <button type="button" class="secondary" onclick={() => gameSession.passDevelopment()}
                >Develop nothing</button
            >
        </div>
    {:else if machineState === MachineState.ExpandingCapacity}
        <p class="prompt">
            Buy or upgrade units in your werks, then press Done. You have ${gameSession.myCash}{#if gameSession.plannedSpend > 0}:
                ${gameSession.plannedSpend} planned, ${gameSession.plannedCash} left{/if}.
        </p>
        <CapacityPlanner />
        <label class="auto-ship">
            <input
                type="checkbox"
                checked={gameSession.autoShip}
                onchange={(event) => gameSession.setAutoShip(event.currentTarget.checked)}
            />
            Sell everything automatically this round
        </label>
        <div class="row">
            <button type="button" class="primary" onclick={() => gameSession.finishExpanding()}
                >{doneLabel}</button
            >
        </div>
    {:else if machineState === MachineState.Shipping}
        <p class="prompt">
            Sell your locomotives{#if firstSale}&nbsp;(your first selling turn){/if}. Hold back any
            you would rather sell in a later selling round.
        </p>
        <SaleList />
        <label class="auto-ship">
            <input
                type="checkbox"
                checked={gameSession.saleAutoShip}
                onchange={(event) => gameSession.setSaleAutoShip(event.currentTarget.checked)}
            />
            Sell everything automatically for the rest of this Production
        </label>
        <div class="row">
            {#if gameSession.plannedShipments.length > 0}
                <button
                    type="button"
                    class="primary"
                    onclick={() => gameSession.ship(gameSession.plannedShipments)}
                    >Sell · +${plannedIncome}</button
                >
            {/if}
            <button type="button" class="secondary" onclick={() => gameSession.ship([])}
                >Hold everything</button
            >
        </div>
    {/if}
</div>

<style>
    .panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 6px 12px 8px;
        color: #232d36;
        font-family: 'LW Baskerville', Georgia, serif;
    }

    .prompt {
        margin: 0;
        font-size: 15px;
        text-align: center;
    }

    .note {
        margin: 0;
        font-size: 13px;
        color: #46596b;
        text-align: center;
    }

    .auto-ship {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        cursor: pointer;
    }

    .auto-ship input {
        width: 16px;
        height: 16px;
        accent-color: #25303a;
    }

    .row {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
</style>
