<script lang="ts">
    import { createRouteWorker } from './routeWorker.js'
    import { assert } from '@tabletop/common'
    import type { GameSession } from '@tabletop/frontend-components'
    import { Market1870, type HydratedState1870, type State1870 } from '@tabletop/1870'
    import { GameTable, ShareTitleActions, type TitleActionDescription } from '@tabletop/18xx-ui'
    import ConnectionRun from './ConnectionRun.svelte'
    import { describe1870Action } from './history.js'
    import { Session1870 } from './session.svelte.js'
    let { gameSession }: { gameSession: GameSession<State1870, HydratedState1870> } = $props()
    const session = $derived.by(() => {
        assert(gameSession instanceof Session1870, '1870 requires its title session')
        return gameSession
    })
    const historyDescription: TitleActionDescription = (action, { companyName, place }) =>
        describe1870Action(
            action,
            {
                companyName,
                place,
                playerName: (id) => session.getPlayerName(id),
                bankName: 'Bank'
            },
            session.presentation.money,
            Market1870
        )
    const privateOperationDescription = (privateCompanyId: string) =>
        session.privateOperationDescription(privateCompanyId)
</script>

<GameTable
    {session}
    {privateOperationDescription}
    {createRouteWorker}
    {historyDescription}
    additionalStockActions={session.stockPanels.menuOptions}
>
    {#snippet actions(_focusLocation, focusRoute)}
        <ShareTitleActions
            {session}
            titleDecision={session.destinationChoice ? connectionRun : undefined}
            operatingPrompt={connectionRun}
            onFocusRoute={focusRoute}
            {privateOperationDescription}
            {createRouteWorker}
        />
    {/snippet}
</GameTable>

{#snippet connectionRun()}
    <ConnectionRun {session} />
{/snippet}
