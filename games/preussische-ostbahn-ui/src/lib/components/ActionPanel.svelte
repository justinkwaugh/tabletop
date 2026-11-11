<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { MachineState, cubesLeft, maxTrackPerExpansion } from '@tabletop/preussische-ostbahn'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction } from '$lib/utils/describeAction.js'
    import AuctionPanel from './AuctionPanel.svelte'
    import Description from './Description.svelte'
    import RailroadBadge from './RailroadBadge.svelte'
    import RailroadChoice from './RailroadChoice.svelte'
    import PanelSummary from './PanelSummary.svelte'
    import { TurnIntent } from '$lib/model/selection.js'
    import WaitingView from './WaitingView.svelte'

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const railroadId = $derived(gameSession.expansionRailroad)
</script>

<div class="panel po-serif">
    {#if gameSession.isViewingHistory}
        {#if gameSession.currentAction}
            <div class="line">
                <Description description={describeAction(gameSession.currentAction)} />
            </div>
        {:else}
            <div class="line">The game is set up.</div>
        {/if}
    {:else if state.machineState === MachineState.ShareBidding}
        <AuctionPanel />
    {:else if (gameSession.choosingAction || gameSession.expanding) && railroadId}
        {@const railroad = state.railroad(railroadId)}
        {@const expansion = state.expansion}
        {@const built = expansion?.built.length ?? 0}
        <PanelSummary
            facts={[`Treasury $${railroad.treasury}`, `${cubesLeft(railroad)} track left`]}
        >
            {#snippet heading()}Build <RailroadBadge {railroadId} /> track{/snippet}
        </PanelSummary>
        {#if gameSession.expanding}
            <div class="buttons">
                <button type="button" class="primary" onclick={() => gameSession.endExpansion()}
                    >Done building</button
                >
                <span class="muted">{built} of {maxTrackPerExpansion(railroadId)} built</span>
            </div>
        {/if}
    {:else if gameSession.intent === TurnIntent.Build}
        <div class="line">Build track for which railroad?</div>
        <div class="buttons">
            {#each gameSession.expandableRailroads as id (id)}
                <RailroadChoice
                    railroadId={id}
                    detail={`$${state.railroad(id).treasury}`}
                    cubes={cubesLeft(state.railroad(id))}
                    onclick={() => gameSession.chooseExpansionRailroad(id)}
                />
            {/each}
        </div>
    {:else if gameSession.intent === TurnIntent.Offer}
        <div class="line">Offer a share of which railroad?</div>
        <div class="buttons">
            {#each gameSession.capitalizableRailroads as id (id)}
                <RailroadChoice railroadId={id} onclick={() => gameSession.capitalize(id)} />
            {/each}
        </div>
    {:else if gameSession.choosingAction}
        <div class="line">Choose your action.</div>
        <div class="buttons">
            {#if gameSession.expandableRailroads.length > 0}
                <button
                    type="button"
                    class="primary"
                    onclick={() => gameSession.chooseIntent(TurnIntent.Build)}>Build track</button
                >
            {/if}
            {#if gameSession.capitalizableRailroads.length > 0}
                <button
                    type="button"
                    class="primary"
                    onclick={() => gameSession.chooseIntent(TurnIntent.Offer)}>Offer a share</button
                >
            {/if}
            <button type="button" class="secondary" onclick={() => gameSession.passTurn()}
                >Pass</button
            >
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
        gap: 8px;
        padding: 8px 12px;
        text-align: center;
        color: var(--po-ink);
        font-size: 15px;
    }

    .line {
        line-height: 1.5;
    }

    .buttons {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 10px;
    }

    .muted {
        color: var(--po-muted);
        font-size: 14px;
    }

    @media (max-width: 639px) {
        .panel {
            padding: 6px 8px;
            font-size: 14px;
        }
    }
</style>
