<script lang="ts">
    import { untrack } from 'svelte'
    import {
        ScalingWrapper,
        HistoryControls,
        DefaultTabs,
        GameChat,
        DefaultTableLayout,
        GameSession
    } from '@tabletop/frontend-components'

    import History from '$lib/components/History.svelte'
    import InformationPanel from '$lib/components/InformationPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import CardPreviewLayer from '$lib/components/CardPreviewLayer.svelte'
    import SeatDetailLayer from '$lib/components/SeatDetailLayer.svelte'
    import GoalsLayer from '$lib/components/GoalsLayer.svelte'
    import FitBox from '$lib/components/FitBox.svelte'
    import FocusChooser from '$lib/components/FocusChooser.svelte'
    import { MachineState } from '@tabletop/oath'
    import type { BoundingBox } from '@tabletop/common'
    import { focusRect, siteFocusRect, type FocusView } from '$lib/definitions/boardFocusAreas.js'

    import type { HydratedOathGameState, OathProjectedState } from '@tabletop/oath'
    import { setGameSession, toOathSession } from '$lib/model/sessionContext.svelte.js'

    let { gameSession }: { gameSession: GameSession<OathProjectedState, HydratedOathGameState> } =
        $props()
    let oath = $derived(toOathSession(gameSession))
    setGameSession(untrack(() => toOathSession(gameSession)))

    // Rule 5 — a focus view or a site's row; choosing the focused one again restores the view before it.
    let wrapper = $state<ScalingWrapper>()
    let boardFocus = $state<{
        key: string
        view: FocusView | undefined
        restore: ReturnType<ScalingWrapper['captureView']>
    }>()

    // Room above the zoom buttons and the chooser, so the focused area is never under them.
    const FOCUS_PADDING = { x: 12, y: 44 }
    const FOCUS_MAX_SCALE = 2

    function focusBoard(key: string, view: FocusView | undefined, rect: BoundingBox | undefined) {
        if (!wrapper) return
        if (boardFocus?.key === key) {
            const { restore } = boardFocus
            boardFocus = undefined
            restore({ animate: true })
            return
        }
        boardFocus = { key, view, restore: boardFocus?.restore ?? wrapper.captureView() }
        if (rect) {
            wrapper.focusRect(rect, {
                animate: true,
                maxScale: FOCUS_MAX_SCALE,
                padding: FOCUS_PADDING
            })
        } else {
            wrapper.fitToContent({ animate: true })
        }
    }

    function focusView(view: FocusView) {
        focusBoard(view, view, view === 'full' ? undefined : focusRect(view))
    }

    function focusSite(slotId: string) {
        focusBoard(`site:${slotId}`, undefined, siteFocusRect(slotId))
    }
</script>

<div class="oath-table">
    <DefaultTableLayout>
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-oath-heading"
                    disabledColor="text-oath-text-muted/40"
                    borderClass="border-b border-oath-divider"
                />
            </div>
            <DefaultTabs
                activeTabClass="py-1 px-3 bg-oath-accent-soft border-2 border-oath-frame rounded-lg text-oath-text font-semibold"
                inactiveTabClass="py-1 px-3 border-2 border-transparent rounded-lg text-oath-text-muted hover:text-oath-text hover:border-oath-frame"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-oath-text-muted"
                        messageTextColor="text-oath-text"
                        composerTextColor="text-oath-text"
                        messageHoverColor="hover:bg-oath-divider"
                        bgColor="bg-oath-surface"
                        inputBgColor="bg-oath-surface-raised"
                        inputBorderColor="border-oath-divider"
                        borderColor="border-oath-frame"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <!-- The panel is capped at a fraction of the column so the map keeps
                 its scale; `FitBox` scales a step that outgrows it (no page scroll). -->
            <FitBox fraction={0.4}>
                {#if gameSession.gameState.result}
                    <GameEndPanel />
                {:else}
                    <div
                        class="info-wrap"
                        class:info-wrap--redundant={oath.isMyTurn &&
                            oath.gameState.machineState === MachineState.ActPhase &&
                            !oath.selection.action}
                    >
                        <InformationPanel />
                    </div>
                    {#if !oath.isViewingHistory}
                        <ActionPanel />
                    {/if}
                {/if}
            </FitBox>
            <div class="grow-0 overflow-hidden min-h-0" style="flex:1;">
                <ScalingWrapper
                    bind:this={wrapper}
                    justify="center"
                    controls="bottom-left"
                    coverBelowScale={0.3}
                    maxScale={FOCUS_MAX_SCALE}
                    onManualViewChange={() => (boardFocus = undefined)}
                >
                    <Board />
                    {#snippet overlay()}
                        <FocusChooser selected={boardFocus?.view} onselect={focusView} />
                    {/snippet}
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
    <!-- Outside the table's scroll columns: a transformed ancestor (the board's
         `ScalingWrapper`, a scaled panel) would be the containing block for these
         fixed layers and scale or clip them with it. -->
    <SeatDetailLayer />
    <GoalsLayer />
    <CardPreviewLayer onZoomSite={focusSite} />
</div>

<style>
    .info-wrap {
        display: contents;
    }
    /* On a phone held sideways the Act Phase header already says what the
       information line says; its height goes to the buttons. */
    @media (max-height: 520px) and (orientation: landscape) {
        .info-wrap--redundant {
            display: none;
        }
    }

    /* A held card must not raise the phone's image menu. */
    .oath-table :global(img) {
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
        -webkit-user-drag: none;
    }
</style>
