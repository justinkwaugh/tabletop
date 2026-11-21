<script lang="ts">
    import { MachineState } from '@tabletop/locomotive-werks'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import LocomotiveBadge from './LocomotiveBadge.svelte'
    import PhaseTrack from './PhaseTrack.svelte'
    import WaitingView from './WaitingView.svelte'
    import CapacityTable from './CapacityTable.svelte'
    import RoundReview from './RoundReview.svelte'
    import ShippingTable from './ShippingTable.svelte'

    const gameSession = getGameSession()

    const state = $derived(gameSession.gameState)
    const machineState = $derived(state.machineState)
    const plannedIncome = $derived(
        gameSession.plannedShipments.reduce((sum, shipment) => sum + shipment.income, 0)
    )
    const firstShipment = $derived(state.lucasOrder && state.sellingRound?.number === 1)
    const doneLabel = $derived(
        `${firstShipment ? 'Done, on to shipping' : 'Done buying'}${
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
        <p class="prompt">Develop a new locomotive. You have ${gameSession.myCash}.</p>
        <div class="row">
            {#each gameSession.developOptions as option (option.locomotive.id)}
                <button
                    type="button"
                    class="choice"
                    disabled={!option.affordable}
                    onclick={() => gameSession.develop(option.locomotive.id)}
                    ><LocomotiveBadge locomotiveId={option.locomotive.id} />
                    <span>${option.locomotive.developmentCost}</span></button
                >
            {/each}
        </div>
        <div class="row">
            <button type="button" class="secondary" onclick={() => gameSession.passDevelopment()}
                >Develop nothing</button
            >
        </div>
    {:else if machineState === MachineState.ExpandingCapacity}
        <p class="prompt">
            Plan production units to buy or upgrade, then press Done. You have ${gameSession.myCash}{#if gameSession.plannedSpend > 0}:
                ${gameSession.plannedSpend} planned, ${gameSession.plannedCash} left{/if}.
        </p>
        <CapacityTable />
        <label class="auto-ship">
            <input type="checkbox" bind:checked={gameSession.autoShip} />
            Ship everything automatically this round
        </label>
        <div class="row">
            <button type="button" class="primary" onclick={() => gameSession.finishExpanding()}
                >{doneLabel}</button
            >
        </div>
    {:else if machineState === MachineState.Shipping}
        <p class="prompt">
            Ship your locomotives{#if firstShipment}&nbsp;(your first shipment){/if}, or hold some
            back.
        </p>
        <ShippingTable />
        <div class="row">
            {#if gameSession.plannedShipments.length > 0}
                <button
                    type="button"
                    class="primary"
                    onclick={() => gameSession.ship(gameSession.plannedShipments)}
                    >Ship · +${plannedIncome}</button
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

    .choice {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 2px solid #a7b8c5;
        border-radius: 8px;
        background: #f5f8fa;
        padding: 4px 8px;
        font-size: 15px;
        font-weight: 700;
    }

    .choice:hover:not(:disabled) {
        border-color: #232d36;
    }

    .choice:disabled {
        opacity: 0.4;
    }
</style>
