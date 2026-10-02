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
    import VisionSeenOverlay from '$lib/components/VisionSeenOverlay.svelte'
    import FitBox from '$lib/components/FitBox.svelte'
    import FocusChooser from '$lib/components/FocusChooser.svelte'
    import { MachineState } from '@tabletop/oath'
    import type { BoundingBox } from '@tabletop/common'
    import { focusRect, siteFocusRect, type FocusView } from '$lib/definitions/boardFocusAreas.js'

    import type { HydratedOathGameState, OathProjectedState } from '@tabletop/oath'
    import { setGameSession, toOathSession } from '$lib/model/sessionContext.svelte.js'
    import { cardPreview } from '$lib/model/cardPreview.svelte.js'
    import type { Attachment } from 'svelte/attachments'

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

    // Room below the chooser and above the zoom buttons, so the focused area is never under them.
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

    let windowHeight = $state(0)

    // The shared wrapper exposes full screen only as its dialog's role (contract rule 6).
    let expanded = $state(false)
    const watchExpansion: Attachment<HTMLElement> = (node) => {
        const dialog = node.closest('dialog')
        if (!dialog) return
        const read = () => {
            expanded = dialog.matches(':modal')
        }
        const observer = new MutationObserver(read)
        observer.observe(dialog, { attributes: true, attributeFilter: ['role'] })
        read()
        return () => observer.disconnect()
    }

    // Rule 7 — Escape closes the topmost layer only: a Vision seen, the enlarged card, then the
    // open goals or seat; with none open it is left to the board's wrapper, which leaves full screen.
    const closesTopLayer: Attachment = () => {
        const escape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return
            if (oath.visionsSeen.draws.length > 0) oath.visionsSeen.clear()
            else if (cardPreview.open) cardPreview.dismiss()
            else if (oath.goalsView.open) oath.goalsView.close()
            else if (oath.seatDetail.openPlayerId) oath.seatDetail.close()
            else return
            event.preventDefault()
            event.stopPropagation()
        }
        window.addEventListener('keydown', escape, { capture: true })
        return () => window.removeEventListener('keydown', escape, { capture: true })
    }

    function focusSite(slotId: string) {
        focusBoard(`site:${slotId}`, undefined, siteFocusRect(slotId))
    }
</script>

<svelte:window bind:innerHeight={windowHeight} />

{#snippet panel()}
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
{/snippet}

<div class="oath-table" {@attach closesTopLayer}>
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
            {#if !expanded}
                <FitBox fraction={0.4}>
                    {@render panel()}
                </FitBox>
            {/if}
            <div class="grow-0 overflow-hidden min-h-0" style="flex:1;">
                <ScalingWrapper
                    bind:this={wrapper}
                    justify="center"
                    controls="bottom-left"
                    coverBelowScale={0.3}
                    maxScale={FOCUS_MAX_SCALE}
                    expandable
                    onManualViewChange={() => (boardFocus = undefined)}
                >
                    <Board />
                    {#snippet overlay()}
                        <FocusChooser selected={boardFocus?.view} onselect={focusView} />
                        <VisionSeenOverlay />
                    {/snippet}
                    {#snippet toolbar()}
                        <!-- Rule 6 — full screen is a modal dialog; anything outside it is behind it. -->
                        <div {@attach watchExpansion}>
                            {#if expanded}
                                <div class="fullscreen-panel">
                                    <FitBox fraction={0.4} basis={windowHeight}>
                                        {@render panel()}
                                    </FitBox>
                                </div>
                                <GoalsLayer />
                                <CardPreviewLayer onZoomSite={focusSite} />
                            {/if}
                        </div>
                    {/snippet}
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
    <!-- Outside the table's scroll columns: a transformed ancestor (the board's
         `ScalingWrapper`, a scaled panel) would be the containing block for these
         fixed layers and scale or clip them with it. -->
    <SeatDetailLayer />
    {#if !expanded}
        <GoalsLayer />
        <CardPreviewLayer onZoomSite={focusSite} />
    {/if}
</div>

<style>
    /* Opaque, so the page under the full-screen dialog does not show through the docked panel. */
    .fullscreen-panel {
        padding: 8px 8px 0;
        background: rgb(12 10 9);
    }
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
