<script lang="ts">
    import { createRouteWorker } from './routeWorker.js'
    import { assert } from '@tabletop/common'
    import type { GameSession } from '@tabletop/frontend-components'
    import { Market1850, type HydratedState1850, type State1850 } from '@tabletop/1850'
    import { GameTable, ShareTitleActions, type TitleActionDescription } from '@tabletop/18xx-ui'
    import { describe1850Action } from './history.js'
    import { Session1850 } from './session.svelte.js'
    import TitleActions from './TitleActions.svelte'
    let { gameSession }: { gameSession: GameSession<State1850, HydratedState1850> } = $props()
    const session = $derived.by(() => {
        assert(gameSession instanceof Session1850, '1850 requires its title session')
        return gameSession
    })
    const historyDescription: TitleActionDescription = (action, { companyName, place }) =>
        describe1850Action(
            action,
            {
                companyName,
                place,
                playerName: (id) => session.getPlayerName(id),
                bankName: 'Bank'
            },
            session.presentation.money,
            Market1850
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
            operatingPrompt={titleActions}
            onFocusRoute={focusRoute}
            {privateOperationDescription}
            {createRouteWorker}
        />
    {/snippet}
</GameTable>

{#snippet titleActions()}
    <TitleActions {session} />
{/snippet}
