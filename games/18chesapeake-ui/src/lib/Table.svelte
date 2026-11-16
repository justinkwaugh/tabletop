<script lang="ts">
    import { createRouteWorker } from './routeWorker.js'
    import type { GameSession } from '@tabletop/frontend-components'
    import {
        CocId,
        PairedLays,
        privatePowerOpen,
        type HydratedStateChesapeake,
        type StateChesapeake
    } from '@tabletop/18chesapeake'
    import {
        CompanyPar,
        GameTable,
        OperatingActions,
        WaterfallAuctionLots
    } from '@tabletop/18xx-ui'
    import { requireSessionChesapeake } from './session.svelte.js'
    let { gameSession }: { gameSession: GameSession<StateChesapeake, HydratedStateChesapeake> } =
        $props()
    const session = $derived(requireSessionChesapeake(gameSession))

    const privateOperationDescription = (id: string) => {
        if (!privatePowerOpen(session.gameState, id)) return undefined
        const pair = PairedLays[id]
        if (pair)
            return `May lay tiles 8 or 9 in ${pair.join(' and ')}, joined across their shared side, without a connection and besides its own lay.`
        return id === CocId
            ? 'May lay #57 in Berlin (D2) as its lay, paying $80, then place a free station there.'
            : undefined
    }
</script>

<GameTable {session} {privateOperationDescription} {createRouteWorker}>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.gameState.pendingPar}
            <CompanyPar {session} />
        {:else if session.waterfall.model && !session.waterfall.model.auction.completed}
            <WaterfallAuctionLots {session} />
        {:else}
            <OperatingActions {privateOperationDescription} onFocusRoute={focusRoute} {session} />
        {/if}
    {/snippet}
</GameTable>
