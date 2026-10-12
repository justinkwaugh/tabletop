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
    import Seascape from '$lib/components/Seascape.svelte'
    import FredokaMedium from '$lib/fonts/Fredoka-Medium-Latin.woff2'
    import FredokaSemiBold from '$lib/fonts/Fredoka-SemiBold-Latin.woff2'
    import GlutenBold from '$lib/fonts/Gluten-Bold-Latin.woff2'
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

<CustomFont fontFamily="Reef Fredoka" url={FredokaMedium} format="woff2" fontWeight="500" />
<CustomFont fontFamily="Reef Fredoka" url={FredokaSemiBold} format="woff2" fontWeight="600" />
<CustomFont fontFamily="Reef Gluten" url={GlutenBold} format="woff2" fontWeight="700" />
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
    <Seascape />
    <!-- Roughens the edges of paper surfaces, like the painted border of the box art. -->
    <svg width="0" height="0" class="absolute" aria-hidden="true">
        <filter id="reef-rough-edge" x="-2%" y="-2%" width="104%" height="104%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="3"
            ></feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="5"></feDisplacementMap>
        </filter>
    </svg>
    <div class="layout">
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
</div>

<style>
    .reef-table {
        --reef-deep: #173f39;
        --reef-teal: #2f6559;
        --reef-shallow: #3f7768;
        --reef-water-top: #8cc6b3;
        --reef-water-mid: #4d8a79;
        --reef-water-bottom: #2a5d53;
        --reef-silhouette: rgb(18 56 50 / 0.55);
        --reef-silhouette-far: rgb(30 78 68 / 0.35);
        --reef-glass: rgb(14 52 46 / 0.5);
        --reef-glass-strong: rgb(12 46 41 / 0.66);
        --reef-line: rgb(255 255 255 / 0.85);
        --reef-edge: rgb(255 255 255 / 0.6);
        --reef-ink: #f3faf7;
        --reef-muted: #cfe5dd;
        --reef-paper: #fbf7ea;
        --reef-paper-ink: #1d473f;
        --reef-paper-muted: #55776e;
        --reef-coral: #ee7b5a;
        --reef-coral-deep: #c95436;
        --reef-accent: #ef8f2e;
        --reef-sun: #ffd98a;
        --reef-wobble: 15px 11px 16px 10px / 11px 16px 10px 15px;
        position: relative;
        isolation: isolate;
        font-family: 'Reef Nunito', 'Trebuchet MS', sans-serif;
        color: var(--reef-ink);
        background:
            radial-gradient(ellipse 60% 40% at 50% -10%, rgb(255 250 220 / 0.35), transparent 70%),
            linear-gradient(
                180deg,
                var(--reef-water-top),
                var(--reef-water-mid) 45%,
                var(--reef-water-bottom)
            );
    }

    .layout {
        position: relative;
        z-index: 1;
    }

    .reef-table.settling :global(.target),
    .reef-table.settling :global(section[aria-label='Actions'] button) {
        pointer-events: none;
    }

    /* Labels, buttons and numbers: rounded like sea-worn pebbles. */
    .reef-table :global(.reef-display) {
        font-family: 'Reef Fredoka', 'Trebuchet MS', sans-serif;
        font-weight: 600;
        letter-spacing: 0.01em;
    }

    /* Big headings take the soft, blobby letters of the box's coral title. */
    .reef-table :global(.reef-title) {
        font-family: 'Reef Gluten', 'Reef Fredoka', sans-serif;
        font-weight: 700;
        letter-spacing: 0.01em;
    }

    /* Sea glass: frosted, with a hand-drawn wobble to its outline. */
    .reef-table :global(.reef-glass) {
        background: var(--reef-glass);
        backdrop-filter: blur(4px) saturate(1.15);
        border-radius: var(--reef-wobble);
        box-shadow:
            inset 0 0 0 1.5px var(--reef-edge),
            inset 0 10px 18px -10px rgb(255 255 255 / 0.25),
            0 6px 16px -6px rgb(4 30 26 / 0.45);
    }

    .history-controls {
        background: var(--reef-glass-strong);
        backdrop-filter: blur(4px);
    }

    .history-controls.framed {
        border-radius: 999px;
        box-shadow:
            inset 0 0 0 1.5px var(--reef-edge),
            0 6px 16px -6px rgb(4 30 26 / 0.45);
    }

    .history-controls.band {
        border-bottom: 1.5px solid var(--reef-edge);
    }

    .reef-table :global(.reef-control-on) {
        color: var(--reef-ink);
    }

    .reef-table :global(.reef-control-off) {
        color: rgb(255 255 255 / 0.3);
    }

    .reef-table :global([role='tablist']:has(.reef-tab)) {
        gap: 6px;
        margin: 0;
        padding: 2px 0 6px;
        border-bottom: none;
    }

    .reef-table :global([role='tablist']:has(.reef-tab) > li) {
        display: flex;
        flex: 1;
        margin: 0;
    }

    /* Tabs are pebbles; the open one is a sunlit shell. */
    .reef-table :global(.reef-tab) {
        flex: 1;
        padding: 5px 8px;
        font-size: 15px;
        color: var(--reef-muted);
        border-radius: 999px;
        background: var(--reef-glass);
        backdrop-filter: blur(4px);
        box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 0.4);
        transition:
            background 0.15s,
            color 0.15s;
    }

    .reef-table :global(.reef-tab > div) {
        justify-content: center;
    }

    .reef-table :global(.reef-tab:hover) {
        color: var(--reef-ink);
        background: var(--reef-glass-strong);
    }

    .reef-table :global(.reef-tab.reef-tab-active) {
        color: var(--reef-paper-ink);
        background: radial-gradient(
            ellipse 90% 120% at 50% 0,
            #fffdf5,
            var(--reef-paper) 60%,
            #eadfc4
        );
        box-shadow:
            inset 0 0 0 1.5px #fff,
            0 4px 10px -4px rgb(4 30 26 / 0.5);
    }

    .reef-table :global(.reef-tab:focus-visible) {
        outline: 2px solid var(--reef-sun);
        outline-offset: 2px;
    }
</style>
