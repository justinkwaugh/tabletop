<script lang="ts">
    import { untrack } from 'svelte'
    import { MediaQuery } from 'svelte/reactivity'
    import {
        DefaultTableLayout,
        DefaultTabs,
        GameChat,
        GameSession,
        HistoryControls,
        ScalingWrapper
    } from '@tabletop/frontend-components'
    import type {
        HydratedKoenigrufenGameState,
        KoenigrufenProjectedState
    } from '@tabletop/koenigrufen'
    import Header from '$lib/components/Header.svelte'
    import ActionArea from '$lib/components/ActionArea.svelte'
    import Board from '$lib/components/Board.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import History from '$lib/components/History.svelte'
    import { KoenigrufenGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

    let {
        gameSession
    }: { gameSession: GameSession<KoenigrufenProjectedState, HydratedKoenigrufenGameState> } =
        $props()

    function ensureKoenigrufenGameSession(
        session: GameSession<KoenigrufenProjectedState, HydratedKoenigrufenGameState>
    ): KoenigrufenGameSession {
        if (session instanceof KoenigrufenGameSession) {
            return session
        }
        throw new Error('GameTable expected a KoenigrufenGameSession')
    }

    setGameSession(untrack(() => ensureKoenigrufenGameSession(gameSession)))

    // The room the table is fitted into; a phone table takes its shape.
    let roomWidth = $state(0)
    let roomHeight = $state(0)
    // On phones the hand spans the table's foot, so the zoom controls go to the free top right.
    const narrow = new MediaQuery('max-width: 640px')
    // A large screen fits the table up to this much bigger than its natural size, inside a margin.
    const MaxFitScale = 1.5
</script>

<div class="koenigrufen-table" aria-busy={gameSession.busy}>
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden"><HistoryControls /></div>
            <DefaultTabs>
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                <Header />
                <ActionArea />
            </div>
            <div
                class="relative grow-0 overflow-hidden"
                style="flex:1;"
                bind:clientWidth={roomWidth}
                bind:clientHeight={roomHeight}
            >
                <ScalingWrapper
                    justify="center"
                    controls={narrow.current ? 'top-right' : 'bottom-left'}
                    maxScale={MaxFitScale}
                    maxFitScale={MaxFitScale}
                    expandable
                >
                    <div class:margin={!narrow.current}>
                        <Board room={{ width: roomWidth, height: roomHeight }} />
                    </div>
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .margin {
        padding: 12px 16px 16px;
    }

    .koenigrufen-table {
        min-height: 100%;
        background: radial-gradient(ellipse at top, #24402e, #101c14 70%);
        color: #f1e7cf;
    }
</style>
