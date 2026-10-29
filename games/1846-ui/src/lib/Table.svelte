<script lang="ts">
    import { createRouteWorker } from './routeWorker.js'
    import { assert } from '@tabletop/common'
    import type { GameSession } from '@tabletop/frontend-components'
    import {
        type EighteenFortySixProjectedState,
        type HydratedEighteenFortySixState,
        CompanyDescriptions1846
    } from '@tabletop/1846'
    import { GameTable, OperatingActions } from '@tabletop/18xx-ui'
    import { EighteenFortySixSession } from './session.svelte.js'
    import OpeningCompanies from './OpeningCompanies.svelte'
    import Draft from './Draft.svelte'
    import SetupHistoryEntry from './SetupHistoryEntry.svelte'
    import RevenueMarkerPrompt from './RevenueMarkerPrompt.svelte'
    import SteamboatAssignment from './SteamboatAssignment.svelte'
    import { describe1846Action } from './history.js'
    import './panels.css'
    let {
        gameSession
    }: { gameSession: GameSession<EighteenFortySixProjectedState, HydratedEighteenFortySixState> } =
        $props()
    const session = $derived.by(() => {
        assert(gameSession instanceof EighteenFortySixSession, '1846 requires its title session')
        return gameSession
    })
    const state = $derived(session.gameState)
    const privateOperationDescription = (id: string) => CompanyDescriptions1846[id]
</script>

<GameTable
    {session}
    {privateOperationDescription}
    {createRouteWorker}
    historyDescription={describe1846Action}
>
    {#snippet historySetup()}<SetupHistoryEntry {session} />{/snippet}
    {#snippet actions(_focusLocation, focusRoute)}
        <div class="midwest-actions">
            {#if state.machineState === 'BuyingOpeningCompanies'}
                <OpeningCompanies {session} />
            {:else if state.machineState === 'Drafting' || state.machineState === 'RevealingDraft'}
                <Draft {session} />
            {:else if state.pendingRevenueMarker}
                <RevenueMarkerPrompt {session} />
            {:else if state.machineState === 'AssigningSteamboat'}
                <SteamboatAssignment {session} />
            {:else}
                <OperatingActions
                    {session}
                    {privateOperationDescription}
                    {createRouteWorker}
                    onFocusRoute={focusRoute}
                />
            {/if}
        </div>
    {/snippet}
</GameTable>
