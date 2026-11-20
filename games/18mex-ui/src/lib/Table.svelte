<script lang="ts">
    import { createRouteWorker } from './routeWorker.js'
    import type { GameSession } from '@tabletop/frontend-components'
    import {
        CopperCanyonLocationId,
        KcmoId,
        type HydratedStateMex,
        type StateMex
    } from '@tabletop/18mex'
    import {
        CompanyPar,
        GameTable,
        OperatingActions,
        WaterfallAuctionLots,
        type TitleActionDescription
    } from '@tabletop/18xx-ui'
    import { describeMexAction } from './history.js'
    import TitleActions from './TitleActions.svelte'
    import { requireSessionMex } from './session.svelte.js'
    let { gameSession }: { gameSession: GameSession<StateMex, HydratedStateMex> } = $props()
    const session = $derived(requireSessionMex(gameSession))

    // The KCM&O's Copper Canyon lay is the only private power (Table III).
    const privateOperationDescription = (id: string) =>
        id === KcmoId
            ? `May lay the Copper Canyon tile in ${session.placeName(CopperCanyonLocationId)} for $60, besides its lays and unconnected; the KCM&O then closes.`
            : undefined
    const historyDescription: TitleActionDescription = (action, names, shared) =>
        describeMexAction(
            action,
            { ...names, playerName: (id) => session.getPlayerName(id), bankName: 'Bank' },
            session.presentation.money,
            shared
        )
</script>

<GameTable {session} {privateOperationDescription} {createRouteWorker} {historyDescription}>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.gameState.pendingPar}
            <CompanyPar {session} />
        {:else if session.waterfall.model && !session.waterfall.model.auction.completed}
            <WaterfallAuctionLots {session} />
        {:else}
            <TitleActions {session} />
            <OperatingActions {privateOperationDescription} onFocusRoute={focusRoute} {session} />
        {/if}
    {/snippet}
</GameTable>
