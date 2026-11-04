<script lang="ts">
    import { createRouteWorker } from './routeWorker.js'
    import { assert } from '@tabletop/common'
    import type { GameSession } from '@tabletop/frontend-components'
    import type { EighteenThirtyTwoState, HydratedEighteenThirtyTwoState } from '@tabletop/1832'
    import { GameTable, ShareTitleActions, type TitleActionDescription } from '@tabletop/18xx-ui'
    import { EighteenThirtyTwoSession } from './session.svelte.js'
    import { describe1832Action } from './history.js'
    import TitleActions from './TitleActions.svelte'
    import MergerPhase from './MergerPhase.svelte'
    let {
        gameSession
    }: { gameSession: GameSession<EighteenThirtyTwoState, HydratedEighteenThirtyTwoState> } =
        $props()
    const session = $derived.by(() => {
        assert(gameSession instanceof EighteenThirtyTwoSession, '1832 requires its title session')
        return gameSession
    })
    const historyDescription: TitleActionDescription = (action, { companyName, place }) =>
        describe1832Action(
            action,
            {
                companyName,
                place,
                playerName: (id) => session.getPlayerName(id),
                bankName: 'Bank'
            },
            session.presentation.money
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
            titleDecision={session.mergerDecision ? mergerPhase : undefined}
            operatingPrompt={titleActions}
            onFocusRoute={focusRoute}
            {privateOperationDescription}
            {createRouteWorker}
        />
    {/snippet}
</GameTable>

{#snippet mergerPhase()}
    <MergerPhase {session} />
{/snippet}

{#snippet titleActions()}
    <TitleActions {session} />
{/snippet}
