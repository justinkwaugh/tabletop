<script lang="ts">
    import { CompanyId, MachineState } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AuctionPanel from './AuctionPanel.svelte'
    import BidStepper from './BidStepper.svelte'
    import CompanyBadge from './CompanyBadge.svelte'
    import WaitingView from './WaitingView.svelte'

    const gameSession = getGameSession()

    const state = $derived(gameSession.gameState)
    const machineState = $derived(state.machineState)
    const cash = $derived(gameSession.myPlayerId ? state.getPlayerState(gameSession.myPlayerId).cash : 0)
    const remainingCubes = $derived(gameSession.maxCubes - gameSession.chosenHexes.length)
</script>

<div class="panel">
    {#if gameSession.isViewingHistory}
        <WaitingView />
    {:else if machineState === MachineState.Bidding}
        <AuctionPanel />
    {:else if !gameSession.canAct}
        <WaitingView />
    {:else if machineState === MachineState.ChoosingAction}
        <p class="prompt">Choose an action below the map. You cannot repeat your last action.</p>
    {:else if machineState === MachineState.PlacingBonusCube}
        <p class="prompt">
            You bought a <CompanyBadge companyId={CompanyId.Streamside} /> share: place one of its cubes
            on a highlighted hex, paying its costs from the treasury (${state.company(CompanyId.Streamside)
                .treasury}).
        </p>
        <div class="row">
            <button type="button" class="secondary" onclick={() => gameSession.skipBonusCube()}
                >Place no cube</button
            >
        </div>
    {:else if machineState === MachineState.BuildingNetwork}
        {#if !gameSession.buildCompany}
            <p class="prompt">Choose which of your companies builds: pick its card beside the map.</p>
        {:else}
            <p class="prompt">
                Build for <CompanyBadge companyId={gameSession.buildCompany} /> (treasury ${state.company(
                    gameSession.buildCompany
                ).treasury}):
                {#if gameSession.chosenHexes.length === 0}
                    choose a highlighted hex for up to {gameSession.maxCubes} cubes. Each costs $2 plus $1 to
                    each grocer already there.
                {:else if gameSession.hexTargets.length > 0}
                    {remainingCubes === 1 ? 'one more cube' : `${remainingCubes} more cubes`} possible, or build
                    now.
                {:else}
                    no further cube can be placed.
                {/if}
            </p>
            {#if gameSession.chosenCost}
                <div class="row">
                    <button type="button" class="primary" onclick={() => gameSession.confirmBuild()}
                        >Build {gameSession.chosenHexes.length}
                        {gameSession.chosenHexes.length === 1 ? 'cube' : 'cubes'} · ${gameSession.chosenCost
                            .total}</button
                    >
                </div>
            {/if}
        {/if}
    {:else if machineState === MachineState.DevelopingTowns}
        {#if gameSession.developCity}
            <p class="prompt">
                <CompanyBadge companyId={CompanyId.Balcones} /> can only pay {gameSession.payeesDue === 1
                    ? 'one grocer'
                    : `${gameSession.payeesDue} grocers`} in {gameSession.cityName(gameSession.developCity)}.
                Choose who gets $1:
            </p>
            <div class="row">
                {#each gameSession.payeeOptions as companyId (companyId)}
                    <button type="button" class="secondary" onclick={() => gameSession.choosePayee(companyId)}
                        ><CompanyBadge {companyId} /></button
                    >
                {/each}
            </div>
        {:else if state.turnDevelopments.length === 0}
            <p class="prompt">
                Place a Development Marker in a highlighted city. Grocers there get $1 each from Balcones
                Builders.
            </p>
        {:else}
            <p class="prompt">
                {#if gameSession.cityTargets.length > 0}
                    Place a second marker in another city, or take $1 from the bank instead.
                {:else}
                    No other city can be developed: take $1 from the bank.
                {/if}
            </p>
            <div class="row">
                <button type="button" class="secondary" onclick={() => gameSession.takeDevelopmentCash()}
                    >Take $1</button
                >
            </div>
        {/if}
    {:else if machineState === MachineState.StartingAuction}
        {#if gameSession.auctionCompany}
            <p class="prompt">
                Open the auction for a <CompanyBadge companyId={gameSession.auctionCompany} full /> share at any
                price you can pay.
            </p>
            <div class="row">
                <BidStepper
                    minimum={0}
                    maximum={cash}
                    label="Open at"
                    onbid={(amount) => gameSession.openAuction(amount)}
                />
            </div>
        {:else}
            <p class="prompt">Choose the company whose share goes up for auction: pick its card.</p>
        {/if}
    {:else}
        <WaitingView />
    {/if}
</div>

<style>
    .panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        color: #3a1a10;
        font-family: 'Libre Baskerville', Georgia, serif;
    }

    .prompt {
        margin: 0;
        font-size: 16px;
        text-align: center;
    }

    .row {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }

    @media (max-width: 639px) {
        .panel {
            padding: 4px 6px;
        }

        .prompt {
            font-size: 14px;
        }
    }
</style>
