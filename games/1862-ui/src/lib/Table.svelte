<script lang="ts">
    import { assert } from '@tabletop/common'
    import type { GameSession } from '@tabletop/frontend-components'
    import type { HydratedState1862, State1862 } from '@tabletop/1862'
    import { GameTable, OperatingActions, type TitleActionDescription } from '@tabletop/18xx-ui'
    import BuyingPrompts from './BuyingPrompts.svelte'
    import Decisions from './Decisions.svelte'
    import Parliament from './Parliament.svelte'
    import TitleModes from './TitleModes.svelte'
    import { describe1862Action } from './history.js'
    import { createRouteWorker } from './routeWorker.js'
    import { Session1862 } from './session.svelte.js'
    let { gameSession }: { gameSession: GameSession<State1862, HydratedState1862> } = $props()
    const session = $derived.by(() => {
        assert(gameSession instanceof Session1862, '1862 requires its title session')
        return gameSession
    })
    // 1862 has no private companies, so no company owns a private's power.
    const privateOperationDescription = () => undefined
    const historyDescription: TitleActionDescription = (action, names) =>
        describe1862Action(action, names, session)
    const state = $derived(session.gameState)
    const deciding = $derived(
        !!state.stationPurchase || !!state.fines || !!state.mergerProposal || !!state.shareMerge
    )
</script>

<GameTable {session} {privateOperationDescription} {createRouteWorker} {historyDescription}>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if state.parliament}
            <Parliament {session} />
        {:else if deciding}
            <Decisions {session} />
        {:else}
            {#if state.machineState === 'BuyingTrains'}<BuyingPrompts {session} />{/if}
            <OperatingActions
                {privateOperationDescription}
                onFocusRoute={focusRoute}
                {session}
                {createRouteWorker}
            >
                {#snippet titleMode()}<TitleModes {session} />{/snippet}
            </OperatingActions>
        {/if}
    {/snippet}
</GameTable>
