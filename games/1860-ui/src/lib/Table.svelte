<script lang="ts">
    import type { GameSession } from '@tabletop/frontend-components'
    import type { HydratedState1860, State1860 } from '@tabletop/1860'
    import { GameTable, OperatingActions, type TitleActionDescription } from '@tabletop/18xx-ui'
    import BankPrivates from './BankPrivates.svelte'
    import CompanyLayers from './CompanyLayers.svelte'
    import InitialAuction from './InitialAuction.svelte'
    import TitleDecisions from './TitleDecisions.svelte'
    import { describe1860Action } from './history.js'
    import { createRouteWorker } from './routeWorker.js'
    import { requireSession1860 } from './session.svelte.js'
    let { gameSession }: { gameSession: GameSession<State1860, HydratedState1860> } = $props()
    const session = $derived(requireSession1860(gameSession))
    // 1860's privates have no powers in the operating round: they pay and are exchanged.
    const privateOperationDescription = () => undefined
    const historyDescription: TitleActionDescription = (action, names) =>
        describe1860Action(action, names, {
            getPlayerName: (playerId) => session.getPlayerName(playerId),
            presentation: session.presentation
        })
    const state = $derived(session.gameState)
</script>

{#snippet layers(reveal: (locationId: string) => void)}<CompanyLayers
        {session}
        {reveal}
    />{/snippet}

<GameTable
    {session}
    {privateOperationDescription}
    {createRouteWorker}
    {historyDescription}
    additionalStockActions={session.stockPanels.menuOptions}
    boardPanel={{ label: 'Company layers', content: layers }}
>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if state.choiceAuction}
            <InitialAuction {session} />
        {:else if session.homeTileCompanyId || session.trainReturn}
            <TitleDecisions {session} />
        {:else if session.stockPanels.open === 'privates'}
            <BankPrivates {session} />
        {:else}
            <OperatingActions {privateOperationDescription} onFocusRoute={focusRoute} {session} />
        {/if}
    {/snippet}
</GameTable>
