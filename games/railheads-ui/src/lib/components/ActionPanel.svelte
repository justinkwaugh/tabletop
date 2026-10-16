<script lang="ts">
    import { MachineState, PlacementKind } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        SPACE_NAMES,
        SPACE_SHORT_NAMES,
        spaceText,
        SPACE_DISPLAY_ORDER
    } from '$lib/utils/describeAction.js'
    import AuctionPanel from './AuctionPanel.svelte'
    import BidStepper from './BidStepper.svelte'
    import BigShareCertificate from './BigShareCertificate.svelte'
    import CompanyBadge from './CompanyBadge.svelte'
    import IndustryAuctionPanel from './IndustryAuctionPanel.svelte'
    import IndustryToken from './IndustryToken.svelte'
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
    const spaceGuide = $derived(
        SPACE_DISPLAY_ORDER.map((space) => ({
            space,
            name: SPACE_SHORT_NAMES[space],
            rules: spaceText(state, space).rules,
            open: gameSession.selectableSpaces.includes(space)
        }))
    )
    const layRules = $derived(
        gameSession.laySpace ? spaceText(state, gameSession.laySpace).rules : ''
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
            {#if gameSession.selectableSpaces.length === 0}
                You can afford no action: consolidate a space to take its
                <span class="bubble pot">waiting</span> coins.
            {:else}
                Choose an action space and pay its <span class="bubble cost">cost</span>, or
                consolidate a space to take its <span class="bubble pot">waiting</span> coins.
            {/if}
        </p>
        <dl class="guide">
            {#each spaceGuide as entry (entry.space)}
                <div class:closed={!entry.open}>
                    <dt>{entry.name}</dt>
                    <dd>{entry.rules}</dd>
                </div>
            {/each}
        </dl>
    {:else if machineState === MachineState.IssuingShare}
        {#if gameSession.issueCompany}
            {@const companyId = gameSession.issueCompany}
            <p class="prompt">
                Open the bidding on a <CompanyBadge {companyId} /> share (minimum ${state.minimumBid(
                    companyId
                )}).
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
                    <BigShareCertificate
                        {companyId}
                        label="Auction a {state.companyDefinition(companyId).name} share"
                        onclick={() => gameSession.selectIssueCompany(companyId)}
                    />
                {/each}
            </div>
        {/if}
    {:else if machineState === MachineState.ChoosingIndustry}
        <p class="prompt">
            Choose an industry token to auction; its development level rises by one.
        </p>
        <div class="row" role="group" aria-label="Industries">
            {#each gameSession.investableIndustries as industry (industry)}
                <button
                    type="button"
                    class="secondary"
                    onclick={() => gameSession.investIn(industry)}
                >
                    <IndustryToken {industry} size={22} labelled /> → level {state.raisedLevel(
                        industry,
                        1
                    )}
                </button>
            {/each}
        </div>
    {:else if machineState === MachineState.LayingTrack && gameSession.laySpace}
        <p class="effects">{SPACE_NAMES[gameSession.laySpace]}: {layRules}.</p>
        <p class="prompt">
            {#if !gameSession.firstCompany}
                Choose a company to build for.
            {:else if gameSession.boostHex}
                Choose how the industry develops.
            {:else if gameSession.buildingCompany}
                Lay a disc{gameSession.layRules?.allowsCrossingCubes ? ' or crossing cube' : ''} for
                <CompanyBadge companyId={gameSession.buildingCompany} />
            {:else}
                Everything allowed is staged.
            {/if}
        </p>
        {#if buildChoices.length > 0}
            <div class="row" role="group" aria-label="Companies">
                {#each buildChoices as companyId (companyId)}
                    <BigShareCertificate
                        {companyId}
                        label="Build for {state.companyDefinition(companyId).name}"
                        onclick={() => gameSession.chooseTrackCompany(companyId)}
                    />
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
                        : 's'} · ${gameSession.stagedCost}{cubes > 0
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
        font-family: 'Railheads Baskerville', Georgia, serif;
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

    .bubble {
        display: inline-block;
        border-radius: 999px;
        padding: 0 6px;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 0.85em;
        font-weight: 700;
        line-height: 1.4;
    }

    .bubble.cost {
        border: 1px solid #7a5f0a;
        background: #e3c34a;
        color: #4a3a05;
    }

    .bubble.pot {
        background: #33401a;
        color: #f4f0d8;
    }

    .guide {
        display: none;
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

        .guide {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 1px 8px;
            margin: 0;
            font-size: 12px;
            line-height: 1.3;
        }

        .guide div {
            display: contents;
        }

        .guide dt {
            font-weight: 700;
            white-space: nowrap;
        }

        .guide dd {
            margin: 0;
            font-family: 'Railheads Baskerville', Georgia, serif;
        }

        .guide .closed > * {
            color: #8d8a70;
        }
    }
</style>
