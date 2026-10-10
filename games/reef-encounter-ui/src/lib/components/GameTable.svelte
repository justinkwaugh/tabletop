<script lang="ts">
    import { untrack } from 'svelte'
    import {
        DefaultSideContent,
        DefaultTableLayout,
        GameSession,
        ScalingWrapper
    } from '@tabletop/frontend-components'
    import type {
        HydratedReefEncounterGameState,
        ReefEncounterProjectedState
    } from '@tabletop/reef-encounter'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionArea from '$lib/components/ActionArea.svelte'
    import Table from '$lib/components/table/Table.svelte'
    import { ReefEncounterGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

    let {
        gameSession
    }: { gameSession: GameSession<ReefEncounterProjectedState, HydratedReefEncounterGameState> } =
        $props()

    function ensureReefEncounterGameSession(
        session: GameSession<ReefEncounterProjectedState, HydratedReefEncounterGameState>
    ): ReefEncounterGameSession {
        if (session instanceof ReefEncounterGameSession) {
            return session
        }
        throw new Error('GameTable expected a ReefEncounterGameSession')
    }

    setGameSession(untrack(() => ensureReefEncounterGameSession(gameSession)))
</script>

<DefaultTableLayout>
    {#snippet sideContent()}
        <DefaultSideContent>
            {#snippet playersPanel()}
                <PlayersPanel />
            {/snippet}
            {#snippet history()}
                <History />
            {/snippet}
        </DefaultSideContent>
    {/snippet}
    {#snippet gameContent()}
        <div class="shrink-0">
            <Header />
            <ActionArea />
        </div>
        <div class="relative grow-0 overflow-hidden" style="flex:1;">
            <ScalingWrapper
                justify="center"
                controls="bottom-left"
                coverBelowScale={0.45}
                expandable
            >
                <Table />
            </ScalingWrapper>
        </div>
    {/snippet}
</DefaultTableLayout>
