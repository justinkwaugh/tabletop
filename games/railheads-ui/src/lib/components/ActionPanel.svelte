<script lang="ts">
    import { MachineState, PlacementKind } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { SPACE_NAMES } from '$lib/utils/describeAction.js'
    import AuctionPanel from './AuctionPanel.svelte'
    import BidStepper from './BidStepper.svelte'
    import CompanyBadge from './CompanyBadge.svelte'
    import IndustryAuctionPanel from './IndustryAuctionPanel.svelte'
    import IndustryToken from './IndustryToken.svelte'
    import ShareCertificate from './ShareCertificate.svelte'
    import WaitingView from './WaitingView.svelte'

    const gameSession = getGameSession()

    const state = $derived(gameSession.gameState)
    const machineState = $derived(state.machineState)
    const cash = $derived(
        gameSession.myPlayerId ? state.getPlayerState(gameSession.myPlayerId).cash : 0
    )
    const cubes = $derived(
        gameSession.placements.filter((placement) => placement.kind === PlacementKind.Cube).length
    )
    const buildChoices = $derived(
        gameSession.placements.length === 0 && !gameSession.firstCompany
            ? gameSession.firstCompanyOptions
            : gameSession.secondCompanyOptions
    )
</script>

<div class="panel">
    {#if gameSession.isViewingHistory}
        <WaitingView />
    {:else if machineState === MachineState.ShareBidding}
        <AuctionPanel />
    {:else if machineState === MachineState.SealedBidding || machineState === MachineState.ResolvingIndustryAuction}
        <IndustryAuctionPanel />
    {:else if !gameSession.canAct}
        <WaitingView />
    {:else if machineState === MachineState.ChoosingAction}
        <p class="prompt">
            Choose an action space for the coins it costs, or consolidate the coins on a space.
        </p>
        <p class="effects">
            {#if gameSession.selectableSpaces.length === 0}
                You can afford no action: consolidate a space.
            {:else}
                Highlighted spaces are open to you.
            {/if}
        </p>
    {:else if machineState === MachineState.IssuingShare}
        {#if gameSession.issueCompany}
            {@const companyId = gameSession.issueCompany}
            <p class="prompt">
                Open the bidding on a <CompanyBadge {companyId} /> share (minimum {gameSession.money(state.minimumBid(companyId))}). Your bid goes to its treasury if nobody tops it.
            </p>
            <BidStepper
                minimum={state.minimumBid(companyId)}
                maximum={cash}
                label="Open at"
                onbid={(amount) => gameSession.issueShare(amount)}
            />
        {:else}
            <p class="prompt">Choose a share to put up for auction.</p>
            <div class="row" role="group" aria-label="Railroad shares">
                {#each gameSession.issuableCompanies as companyId (companyId)}
                    <button
                        type="button"
                        class="secondary"
                        onclick={() => gameSession.selectIssueCompany(companyId)}
                    >
                        <ShareCertificate {companyId} /> from {gameSession.money(state.minimumBid(companyId))}
                    </button>
                {/each}
            </div>
        {/if}
    {:else if machineState === MachineState.ChoosingIndustry}
        <p class="prompt">Choose an industry token to auction; its development level rises by one.</p>
        <div class="row" role="group" aria-label="Industries">
            {#each gameSession.investableIndustries as industry (industry)}
                <button
                    type="button"
                    class="secondary"
                    onclick={() => gameSession.investIn(industry)}
                >
                    <IndustryToken {industry} size={22} labelled /> → level {state.raisedLevel(industry, 1)}
                </button>
            {/each}
        </div>
    {:else if machineState === MachineState.LayingTrack && gameSession.laySpace}
        <p class="prompt">
            {SPACE_NAMES[gameSession.laySpace]}:
            {#if !gameSession.firstCompany}
                choose a company to build for.
            {:else if gameSession.boostHex}
                choose how the industry develops.
            {:else if gameSession.buildingCompany}
                lay a disc{gameSession.layRules?.allowsCrossingCubes ? ' or crossing cube' : ''} for
                <CompanyBadge companyId={gameSession.buildingCompany} /> on a ringed hex.
            {:else}
                everything allowed is staged.
            {/if}
        </p>
        {#if buildChoices.length > 0}
            <div class="row" role="group" aria-label="Companies">
                {#each buildChoices as companyId (companyId)}
                    <button
                        type="button"
                        class="secondary"
                        onclick={() => gameSession.chooseTrackCompany(companyId)}
                        ><CompanyBadge {companyId} /></button
                    >
                {/each}
            </div>
        {/if}
        <div class="row">
            <button type="button" class="primary" onclick={() => gameSession.layTrack()}>
                {#if gameSession.placements.length === 0}
                    Lay no track
                {:else}
                    Lay {gameSession.placements.length} piece{gameSession.placements.length === 1
                        ? ''
                        : 's'} · {gameSession.money(gameSession.stagedCost)}{cubes > 0
                        ? ` (${cubes} cube${cubes === 1 ? '' : 's'})`
                        : ''}
                {/if}
            </button>
        </div>
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
        color: #26300f;
        font-family: 'Libre Baskerville', Georgia, serif;
    }

    .prompt {
        margin: 0;
        font-size: 16px;
        text-align: center;
    }

    .effects {
        margin: 0;
        font-size: 13px;
        font-style: italic;
        color: #5b5a36;
        text-align: center;
    }

    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
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
