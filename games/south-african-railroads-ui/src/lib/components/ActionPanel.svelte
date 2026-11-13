<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { ACTION_BOXES, MachineState } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BOX_SHORT_NAMES, boxContext, boxRules, linkName } from '$lib/utils/describeAction.js'
    import AuctionPanel from './AuctionPanel.svelte'
    import BigShareCertificate from './BigShareCertificate.svelte'
    import RailroadBadge from './RailroadBadge.svelte'
    import WaitingView from './WaitingView.svelte'

    const gameSession = getGameSession()

    const state = $derived(gameSession.gameState)
    const map = $derived(state.map)
    const freeId = $derived(state.freeDevelopmentTarget())
    const freeName = $derived(freeId ? map.settlement(freeId).name : undefined)
    const ORDINALS = ['first', 'second', 'third']
    const nextDevelopment = $derived(ORDINALS[state.developmentsThisTurn] ?? 'another')
    const automaticTarget = $derived(state.automaticDevelopmentTarget())
    const special = $derived(map.definition.specialConnection)
    const machineState = $derived(state.machineState)
    const me = $derived(gameSession.myPlayerId)
    const holdings = $derived(me ? state.holdings(me) : [])
    const boxGuide = $derived(
        ACTION_BOXES.map((box) => ({
            box,
            name: BOX_SHORT_NAMES[box],
            rules: boxRules(map, box, boxContext(state)),
            open: gameSession.selectableBoxes.includes(box),
            paysDividends: gameSession.dividendBoxes.includes(box)
        }))
    )
</script>

{#snippet railroadChoices()}
    <div class="row">
        {#each gameSession.railroadChoices as railroadId (railroadId)}
            <button
                type="button"
                class="secondary"
                onclick={() => gameSession.selectRailroad(railroadId)}
                ><RailroadBadge {railroadId} /></button
            >
        {/each}
    </div>
{/snippet}

<div class="panel">
    {#if gameSession.isViewingHistory}
        <WaitingView />
    {:else if machineState === MachineState.Bidding}
        <AuctionPanel />
    {:else if !gameSession.canAct}
        <WaitingView />
    {:else if machineState === MachineState.FreeBuild && state.freeBuild}
        <p class="prompt">
            Lay the <RailroadBadge railroadId={state.freeBuild.railroadId} /> free first link out of
            {map.settlement(map.home(state.freeBuild.railroadId)).name}: choose a highlighted link.
        </p>
    {:else if machineState === MachineState.ChoosingAction}
        <p class="prompt">
            Choose an action below. A <span class="bubble pays">red</span> box pays {state.isFinalPayoffNext()
                ? 'the final payoff'
                : 'dividends'} at once.
        </p>
        <dl class="guide">
            {#each boxGuide as entry (entry.box)}
                <div class:closed={!entry.open}>
                    <dt class:pays={entry.paysDividends}>{entry.name}</dt>
                    <dd>{entry.rules}</dd>
                </div>
            {/each}
        </dl>
    {:else if machineState === MachineState.ConstructingTrack || machineState === MachineState.DelegatedBuild}
        {#if gameSession.delegating}
            {#if gameSession.selectedRailroad && gameSession.delegateBuilders.length > 1}
                <p class="prompt">
                    Who builds for the <RailroadBadge railroadId={gameSession.selectedRailroad} />?
                </p>
                <div class="row">
                    {#each gameSession.delegateBuilders as builderId (builderId)}
                        <button
                            type="button"
                            class="secondary"
                            onclick={() =>
                                gameSession.selectedRailroad &&
                                gameSession.delegateBuild(gameSession.selectedRailroad, builderId)}
                            ><PlayerName playerId={builderId} /></button
                        >
                    {/each}
                </div>
            {:else}
                <p class="prompt">
                    You control no railroad that can build. Choose one; its controlling shareholder
                    builds.
                </p>
                {@render railroadChoices()}
            {/if}
        {:else if !gameSession.selectedRailroad}
            <p class="prompt">Choose which of your railroads builds.</p>
            {@render railroadChoices()}
        {:else if gameSession.firstLink}
            <p class="prompt">
                {linkName(map, gameSession.firstLink)} chosen. Add a second link for ${state.doubleLinkCost(
                    gameSession.selectedRailroad
                )} in all, or build this one alone.
            </p>
            <div class="row">
                <button
                    type="button"
                    class="primary"
                    onclick={() => gameSession.buildFirstLinkAlone()}
                    >Build one link · ${state.linkCost(gameSession.selectedRailroad)}</button
                >
            </div>
        {:else}
            <p class="prompt">
                Build for the <RailroadBadge railroadId={gameSession.selectedRailroad} /> (treasury ${state.railroad(
                    gameSession.selectedRailroad
                ).treasury}): one link ${state.linkCost(
                    gameSession.selectedRailroad
                )}{#if state.doubleBuilds(gameSession.selectedRailroad).length > 0}, two links ${state.doubleLinkCost(
                        gameSession.selectedRailroad
                    )}{/if}{#if gameSession.connectionTargets.length > 0}, or a connection{/if}.
            </p>
            {#if special && gameSession.specialConnectionPartners.length > 0}
                <div class="row" role="group" aria-label="The {special.name}">
                    {#each gameSession.specialConnectionPartners as partnerId (partnerId)}
                        <button
                            type="button"
                            class="secondary"
                            onclick={() => gameSession.foundSpecialConnection(partnerId)}
                            >Found the {special.name} with the <RailroadBadge
                                railroadId={partnerId}
                            /> · ${special.cost}</button
                        >
                    {/each}
                </div>
            {/if}
        {/if}
    {:else if machineState === MachineState.DevelopingSettlements}
        <p class="prompt">
            {#if state.developmentsThisTurn === 0}
                Develop a settlement served by a railroad{#if freeName}, or {freeName}{/if}.
                {#if gameSession.leaveTownTargets.length > 0}
                    Or leave town: take a cube from a settlement ringed in red.
                {/if}
            {:else if state.developmentsThisTurn < state.freeDevelopments()}
                Develop a {nextDevelopment} settlement free{#if freeName}, or {freeName}{/if}.
            {:else}
                Develop a {nextDevelopment} settlement for $3 of your own cash{#if freeName}, or {freeName}
                    free{/if}.
            {/if}
        </p>
        <p class="effects">
            It moves to its next income, and every railroad link into it earns the difference.
        </p>
        {#if gameSession.mayFinishDeveloping}
            <div class="row">
                <button
                    type="button"
                    class="secondary"
                    onclick={() => gameSession.finishDevelopment()}
                    >{automaticTarget
                        ? `Decline · ${map.settlement(automaticTarget).name} develops`
                        : 'Decline'}</button
                >
            </div>
        {/if}
    {:else if machineState === MachineState.OfferingStock}
        <p class="prompt">
            {#if state.unsoldOffers().length > 0 && holdings.length > 0}
                Offer a railroad's unsold share, or sell one of your own.
            {:else if state.unsoldOffers().length > 0}
                Offer a railroad's unsold share.
            {:else}
                Every share is sold. You may sell one of your own.
            {/if}
        </p>
        {#if state.unsoldOffers().length > 0}
            <div class="row" role="group" aria-label="Railroad shares">
                {#each state.unsoldOffers() as railroadId (railroadId)}
                    <BigShareCertificate
                        {railroadId}
                        choice={{
                            label: `Offer a ${map.railroad(railroadId).shortName} share`,
                            onclick: () => gameSession.offerShare(railroadId, false)
                        }}
                    />
                {/each}
            </div>
        {/if}
        {#if holdings.length > 0}
            <div class="row" role="group" aria-label="Your shares">
                <span class="group-label">Yours</span>
                {#each holdings as holding (holding.railroadId)}
                    <BigShareCertificate
                        railroadId={holding.railroadId}
                        choice={{
                            label: `Sell one of your ${map.railroad(holding.railroadId).shortName} shares`,
                            onclick: () => gameSession.offerShare(holding.railroadId, true)
                        }}
                    />
                {/each}
            </div>
        {/if}
        {#if state.unsoldOffers().length === 0}
            <div class="row">
                <button type="button" class="secondary" onclick={() => gameSession.declineOffer()}
                    >Offer nothing</button
                >
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
        color: #18222f;
        font-family: 'SAR Baskerville', Georgia, serif;
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
        color: #2f445c;
        text-align: center;
    }

    .bubble {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 0 6px;
        font-family: 'SAR Bitter', Georgia, serif;
        font-size: 0.85em;
        font-weight: 700;
    }

    .bubble.pays {
        background: #c42a22;
        color: #ffffff;
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

    .group-label {
        font-family: 'SAR Bitter', Georgia, serif;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #2f445c;
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

        .guide dt.pays {
            color: #b0262e;
        }

        .guide dd {
            margin: 0;
        }

        .guide .closed > * {
            color: #577ba8;
        }
    }
</style>
