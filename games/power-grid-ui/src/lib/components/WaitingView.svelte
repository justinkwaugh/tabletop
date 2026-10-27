<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { MachineState } from '@tabletop/power-grid'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction, type Line } from '$lib/utils/describe.js'
    import Description from './Description.svelte'
    import Elektro from './actions/Elektro.svelte'

    const session = getGameSession()
    const state = $derived(session.gameState)
    const actor = $derived(state.activePlayerIds[0])
    const bidding = $derived(state.bidding())

    const lastLines: Line[] = $derived.by(() => {
        for (const action of session.actions.toReversed()) {
            const lines = describeAction(action)
            if (lines.length > 0) {
                return lines.slice(0, 2)
            }
        }
        return []
    })

    const ACTIVITY: Partial<Record<MachineState, string>> = {
        [MachineState.PlacingTrust]: 'is placing a Trust house',
        [MachineState.ChoosingPlant]: 'is choosing a power plant to auction',
        [MachineState.ScrappingPlant]: 'is choosing a plant to scrap',
        [MachineState.BuyingResources]: 'is buying resources',
        [MachineState.Building]: 'is connecting cities'
    }
</script>

<div class="waiting">
    <p class="status">
        {#if state.machineState === MachineState.Bidding && bidding && state.auction}
            Auction for plant <span class="plant">{state.auction.plant}</span>:
            <PlayerName playerId={bidding.highBidderId} /> bids <Elektro
                amount={bidding.highBid}
            />. Waiting for <PlayerName playerId={actor} />.
        {:else if state.machineState === MachineState.Powering}
            Bureaucracy: waiting for
            {#each state.activePlayerIds as playerId, index (playerId)}{index > 0
                    ? index === state.activePlayerIds.length - 1
                        ? ' and '
                        : ', '
                    : ''}<PlayerName {playerId} />{/each}
            to power their cities.
        {:else if actor && ACTIVITY[state.machineState]}
            <PlayerName playerId={actor} />
            {ACTIVITY[state.machineState]}.
        {/if}
    </p>
    {#each lastLines as line, index (index)}
        <p class="last"><Description {line} /></p>
    {/each}
</div>

<style>
    .status {
        font-size: 18px;
        font-weight: 600;
    }
    .last {
        font-size: 15px;
        color: #cfd4bd;
    }
    .plant {
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
    }
</style>
