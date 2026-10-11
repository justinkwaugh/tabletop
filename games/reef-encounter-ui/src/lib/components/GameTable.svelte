<script lang="ts">
    import { untrack } from 'svelte'
    import {
        CustomFont,
        DefaultTableLayout,
        DefaultTabs,
        GameChat,
        GameSession,
        HistoryControls,
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
    import PlayerAid from '$lib/components/PlayerAid.svelte'
    import { ReefEncounterGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import ComicNeueBold from '$lib/fonts/ComicNeue-Bold-Latin.woff2'
    import Nunito from '$lib/fonts/Nunito-Latin.woff2'

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

    const reefSession = untrack(() => ensureReefEncounterGameSession(gameSession))
    setGameSession(reefSession)
</script>

<CustomFont fontFamily="Reef Comic Neue" url={ComicNeueBold} format="woff2" fontWeight="bold" />
<CustomFont fontFamily="Reef Nunito" url={Nunito} format="woff2" fontWeight="400 700" />

{#snippet historyControls(shape: 'framed' | 'band')}
    <div class="history-controls {shape}">
        <HistoryControls
            borderClass=""
            bgClass="bg-transparent"
            enabledColor="reef-control-on"
            disabledColor="reef-control-off"
        />
    </div>
{/snippet}

<!-- Shows that the session refuses choices while a change plays out. -->
<div class="reef-table" class:settling={gameSession.busy}>
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            {@render historyControls('band')}
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">{@render historyControls('framed')}</div>
            <DefaultTabs
                fontClass="reef-display"
                activeTabClass="reef-tab reef-tab-active"
                inactiveTabClass="reef-tab"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        bgColor="bg-(--reef-deep)"
                        borderColor="border-(--reef-line)"
                        timeColor="text-(--reef-muted)"
                        messageTextColor="text-(--reef-ink)"
                        composerTextColor="text-(--reef-ink)"
                        messageHoverColor="hover:bg-(--reef-shallow)"
                        inputBgColor="bg-(--reef-shallow)"
                        inputBorderColor="border-(--reef-line)"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                <Header />
                <ActionArea />
            </div>
            <div class="relative grow-0 overflow-hidden" style="flex:1;">
                <div class="h-full w-full" inert={reefSession.playerAidOpen}>
                    <ScalingWrapper
                        justify="center"
                        controls="bottom-left"
                        coverBelowScale={0.3}
                        expandable
                    >
                        <Table />
                    </ScalingWrapper>
                </div>
                {#if reefSession.playerAidOpen}
                    <PlayerAid />
                {/if}
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .reef-table {
        --reef-deep: #24463c;
        --reef-teal: #3f6b5c;
        --reef-shallow: #4d7b6b;
        --reef-water-top: #6c9f90;
        --reef-water-bottom: #4f8373;
        --reef-sea: #8fbfae;
        --reef-line: rgb(255 255 255 / 0.85);
        --reef-ink: #f3faf7;
        --reef-muted: #d2e6df;
        --reef-accent: #ef8f2e;
        font-family: 'Reef Nunito', 'Trebuchet MS', sans-serif;
        color: var(--reef-ink);
        background:
            radial-gradient(ellipse 70% 45% at 55% -8%, rgb(255 255 255 / 0.16), transparent 70%),
            linear-gradient(180deg, var(--reef-water-top), var(--reef-water-bottom));
    }

    .reef-table.settling :global(.target),
    .reef-table.settling :global(section[aria-label='Actions'] button) {
        pointer-events: none;
    }

    .reef-table :global(.reef-display) {
        font-family: 'Reef Comic Neue', 'Comic Sans MS', 'Trebuchet MS', sans-serif;
        font-weight: 700;
    }

    .history-controls {
        background: rgb(0 0 0 / 0.26);
    }

    .history-controls.framed {
        border-radius: 8px;
        box-shadow: inset 0 0 0 2px var(--reef-line);
    }

    .history-controls.band {
        border-bottom: 2px solid var(--reef-line);
    }

    .reef-table :global(.reef-control-on) {
        color: var(--reef-ink);
    }

    .reef-table :global(.reef-control-off) {
        color: rgb(255 255 255 / 0.3);
    }

    .reef-table :global(.reef-tab) {
        padding: 6px 10px;
        font-size: 16px;
        color: var(--reef-muted);
        border-radius: 8px 8px 0 0;
        letter-spacing: 0.02em;
    }

    .reef-table :global(.reef-tab-active) {
        color: var(--reef-ink);
        box-shadow: inset 0 -3px 0 var(--reef-accent);
    }
</style>
