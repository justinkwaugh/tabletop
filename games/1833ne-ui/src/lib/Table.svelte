<script lang="ts">
    import { assert } from '@tabletop/common'
    import type { GameSession } from '@tabletop/frontend-components'
    import {
        PrivateRules1833NE,
        type HydratedState1833NE,
        type State1833NE
    } from '@tabletop/1833ne'
    import {
        GameTable,
        OperatingActions,
        WaterfallAuctionLots,
        type TitleActionDescription
    } from '@tabletop/18xx-ui'
    import { createRouteWorker } from './routeWorker.js'
    import { Session1833NE } from './session.svelte.js'
    import Ferries from './Ferries.svelte'
    import Takeovers from './Takeovers.svelte'
    import { describeTakeoverAction } from './takeovers.js'
    let { gameSession }: { gameSession: GameSession<State1833NE, HydratedState1833NE> } = $props()
    const session = $derived.by(() => {
        assert(gameSession instanceof Session1833NE, '1833NE requires its title session')
        return gameSession
    })
    const privateOperationDescription = (id: string) =>
        PrivateRules1833NE.description(session.gameState, id)
    const historyDescription: TitleActionDescription = (action) =>
        describeTakeoverAction(action, session.takeoverNames)
</script>

<GameTable {session} {privateOperationDescription} {createRouteWorker} {historyDescription}>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.waterfall.model && !session.waterfall.model.auction.completed}
            <WaterfallAuctionLots {session} />
        {:else if session.takeoverDecision}
            <Takeovers {session} />
        {:else}
            <OperatingActions
                {privateOperationDescription}
                onFocusRoute={focusRoute}
                {session}
                {createRouteWorker}
            >
                {#snippet titleMode()}<Ferries {session} />{/snippet}
            </OperatingActions>
        {/if}
    {/snippet}
</GameTable>
