<script lang="ts">
    import {
        ActionSpace,
        CompanyId,
        MachineState,
        companyDefinition
    } from '@tabletop/hill-country-grocers'
    import { ACTION_RULES } from '$lib/utils/actionRules.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AuctionPanel from './AuctionPanel.svelte'
    import BigShareCertificate from './BigShareCertificate.svelte'
    import CompanyBadge from './CompanyBadge.svelte'
    import WaitingView from './WaitingView.svelte'

    const gameSession = getGameSession()

    const state = $derived(gameSession.gameState)
    const machineState = $derived(state.machineState)
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
        <p class="prompt">Choose an action.</p>
    {:else if machineState === MachineState.PlacingBonusCube}
        <p class="prompt">
            You bought a <CompanyBadge companyId={CompanyId.Streamside} /> share: place one of its stores
            on a highlighted hex, paying its costs from the treasury (${state.company(CompanyId.Streamside)
                .treasury}).
        </p>
        <div class="row">
            <button type="button" class="secondary" onclick={() => gameSession.skipBonusCube()}
                >Place no store</button
            >
        </div>
    {:else if machineState === MachineState.BuildingNetwork}
        {#if !gameSession.buildCompany}
            <p class="prompt">Choose which of your grocers builds:</p>
            <div class="row">
                {#each gameSession.buildCompanyOptions as companyId (companyId)}
                    <button
                        type="button"
                        class="secondary"
                        onclick={() => gameSession.selectBuildCompany(companyId)}
                        ><CompanyBadge {companyId} /></button
                    >
                {/each}
            </div>
        {:else}
            <p class="prompt">
                Build for <CompanyBadge companyId={gameSession.buildCompany} /> (${state.company(
                    gameSession.buildCompany
                ).treasury}):
                {#if gameSession.chosenHexes.length === 0}
                    choose up to {gameSession.maxCubes} hexes.
                {:else if gameSession.hexTargets.length > 0}
                    {remainingCubes === 1 ? 'one more store' : `${remainingCubes} more stores`} possible, or build
                    now.
                {:else}
                    no further store can be placed.
                {/if}
            </p>
            {#if gameSession.chosenCost}
                <div class="row">
                    <button type="button" class="primary" onclick={() => gameSession.confirmBuild()}
                        >Build {gameSession.chosenHexes.length}
                        {gameSession.chosenHexes.length === 1 ? 'store' : 'stores'} · ${gameSession.chosenCost
                            .total}</button
                    >
                </div>
            {/if}
        {/if}
        <p class="rules">{ACTION_RULES[ActionSpace.BuildNetwork]}</p>
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
                Place a development.
            </p>
        {:else}
            <p class="prompt">
                {#if gameSession.cityTargets.length > 0}
                    Place a second development in another city, or take $1 from the bank instead.
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
        {#if gameSession.cityTargets.length > 0}
            <p class="rules">{ACTION_RULES[ActionSpace.DevelopTowns]}</p>
        {/if}
    {:else if machineState === MachineState.StartingAuction}
        {#if gameSession.auctionCompany}
            <AuctionPanel />
        {:else}
            <p class="prompt">Select the company share for auction:</p>
            <div class="row">
                {#each gameSession.auctionCompanyOptions as companyId (companyId)}
                    <BigShareCertificate
                        {companyId}
                        choice={{
                            label: `Auction the ${companyDefinition(companyId).name} share`,
                            onclick: () => gameSession.selectAuctionCompany(companyId)
                        }}
                    />
                {/each}
            </div>
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

    .rules {
        margin: 0;
        max-width: 60rem;
        font-size: 13.5px;
        font-style: italic;
        color: #7a4a2e;
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
