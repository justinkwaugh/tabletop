<script lang="ts">
    import { untrack } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import {
        CustomFont,
        ScalingWrapper,
        DefaultSideContent,
        DefaultTableLayout,
        GameSession,
        HistoryControls
    } from '@tabletop/frontend-components'
    import type { HydratedFeudumGameState, FeudumProjectedState } from '@tabletop/feudum'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import ActionArea from '$lib/components/table/ActionArea.svelte'
    import FocusChooser from '$lib/components/table/FocusChooser.svelte'
    import BoardCorner from '$lib/components/table/BoardCorner.svelte'
    import Header from '$lib/components/table/Header.svelte'
    import SeatStrip from '$lib/components/table/SeatStrip.svelte'
    import StatusStrip from '$lib/components/table/StatusStrip.svelte'
    import { setTableLayers } from '$lib/components/table/tableLayersContext.js'
    import TableOverlays from '$lib/components/table/TableOverlays.svelte'
    import { FontFaces } from '$lib/fonts/fonts.js'
    import {
        BoardFocus,
        ChooserInset,
        CoverBelowScale,
        deskRestScaleOf,
        deskScaledHeight,
        litAreasOf,
        pickFrameOf,
        restScaleOf,
        ZoomRowBand
    } from '$lib/model/boardFocus.svelte.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { FeudumGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import { BoardWidth } from '$lib/utils/boardGeometry.js'

    let {
        gameSession
    }: { gameSession: GameSession<FeudumProjectedState, HydratedFeudumGameState> } = $props()

    function ensureFeudumGameSession(
        session: GameSession<FeudumProjectedState, HydratedFeudumGameState>
    ): FeudumGameSession {
        if (session instanceof FeudumGameSession) {
            return session
        }
        throw new Error('GameTable expected a FeudumGameSession')
    }

    const feudumSession = untrack(() => ensureFeudumGameSession(gameSession))
    setGameSession(feudumSession)
    setTableLayers(feudumSession.layers)

    const phone = new PhoneLayout()

    let wrapper = $state<ScalingWrapper>()
    let viewSize = $state({ width: 0, height: 0 })

    /**
     * Contract, Board focus: never read for an offer. A phone's chooser stands over the board; a
     * desk's is in the zoom row, rests on the whole board and frames a pick its view leaves out.
     */
    const focus = new BoardFocus({
        view: () => wrapper,
        restScale: () =>
            phone.phone
                ? restScaleOf(viewSize.width, viewSize.height)
                : deskRestScaleOf(
                      viewSize.width,
                      viewSize.height,
                      feudumSession.gameState.players.length
                  ),
        sideways: () => phone.sideways,
        animate: () => !phone.reducedMotion,
        desk: () => (phone.phone ? undefined : viewSize)
    })

    /**
     * Contract, Phone layout: a phone drafts its hand in a bottom sheet over the board, and keeps it
     * there, short, once the hand is set.
     */
    let handSheet = $derived(
        phone.phone &&
            (feudumSession.handPanel?.drafting !== undefined ||
                feudumSession.handPanel?.set !== undefined)
    )

    /**
     * Contract, Supply: on a desk the board's view is as tall as the board, the standings' strip
     * and the zoom row's band at the column's width, so the row stands under the strip; where the
     * action area leaves less (the hand tray), it gives way and the wrapper fits it all to the
     * height left. A phone's view takes the column's height.
     */
    let deskView = $derived(
        `aspect-ratio:${BoardWidth} / ${deskScaledHeight(feudumSession.gameState.players.length)}`
    )

    let litAreas = $derived(litAreasOf(feudumSession.gameState, feudumSession.boardOffer))
    let pickFrame = $derived(
        feudumSession.benchCovers
            ? undefined
            : pickFrameOf(
                  feudumSession.gameState,
                  feudumSession.boardOffer,
                  feudumSession.boardPopup?.anchor
              )
    )

    const measureView: (viewport: HTMLElement) => Attachment<HTMLElement> = (viewport) => () => {
        const read = () => {
            const { clientWidth: width, clientHeight: height } = viewport
            if (width !== viewSize.width || height !== viewSize.height) {
                viewSize = { width, height }
                focus.settle()
            }
        }
        // The next frame: refitting inside the observer's own delivery would resize what it watches.
        const observer = new ResizeObserver(() => requestAnimationFrame(read))
        observer.observe(viewport)
        read()
        return () => observer.disconnect()
    }

    /** The wrapper shows full screen only as its dialog becoming modal. */
    let expanded = $state(false)
    const watchExpansion: Attachment<HTMLElement> = (node) => {
        const dialog = node.closest('dialog')
        if (!dialog) {
            return
        }
        const read = () => {
            expanded = dialog.matches(':modal')
        }
        const observer = new MutationObserver(read)
        observer.observe(dialog, { attributes: true, attributeFilter: ['role'] })
        read()
        return () => observer.disconnect()
    }

    /**
     * Contract, Coexistence and precedence: Escape closes one layer at a time, and only with none
     * open does it reach the wrapper, to leave full screen. Taken on the way down, before the dialog.
     */
    function onEscape(event: KeyboardEvent) {
        if (event.key === 'Escape' && feudumSession.layers.escape()) {
            event.preventDefault()
            event.stopPropagation()
        }
    }
</script>

{#each FontFaces as face (face.family)}
    <CustomFont fontFamily={face.family} url={face.url} format={face.format} />
{/each}

<svelte:window onkeydowncapture={onEscape} />

{#snippet deskRow()}
    <!-- Contract, Supply: the desk's zoom row goes on with the focus buttons. -->
    <FocusChooser
        {focus}
        lit={litAreas}
        frame={pickFrame}
        turned={false}
        desk
        onTracks={() => feudumSession.layers.openTracks()}
    />
{/snippet}

{#snippet turnControls()}
    <div class="bg-feudum-surface" data-turn-controls>
        <Header />
        {#if phone.upright}
            <StatusStrip />
        {/if}
        <div
            class="action-cap"
            data-action-cap
            data-hand-sheet={handSheet ? '' : undefined}
            inert={feudumSession.updatingVisibleState}
        >
            <ActionArea />
        </div>
    </div>
{/snippet}

<div
    class="feudum-table"
    data-phone={phone.upright ? 'upright' : phone.sideways ? 'sideways' : undefined}
>
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls />
        {/snippet}
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
            <div class="game-stack">
                <div class="shrink-0">
                    {#if !expanded}
                        {@render turnControls()}
                    {/if}
                </div>
                <div
                    class="board-view relative grow-0 overflow-hidden"
                    style={phone.phone ? 'flex:1;' : deskView}
                    data-board-view
                >
                    <ScalingWrapper
                        bind:this={wrapper}
                        justify={phone.phone ? 'center' : 'left'}
                        controls="bottom-left"
                        coverBelowScale={CoverBelowScale}
                        insetTop={phone.phone ? ChooserInset : 0}
                        expandable
                        onManualViewChange={() => focus.handMoved()}
                    >
                        <Board
                            rails={phone.phone
                                ? focus.shown === 'west' || focus.shown === 'east'
                                    ? focus.shown
                                    : undefined
                                : 'strip'}
                        />
                        <!-- The zoom row's band: the board never rests under the zoom buttons, Key or Supply. -->
                        <div class="block" style:height="{ZoomRowBand}px" data-zoom-row-band></div>
                        {#snippet overlay(viewport)}
                            <div class="contents" {@attach measureView(viewport)}>
                                {#if phone.phone}
                                    <FocusChooser
                                        {focus}
                                        lit={litAreas}
                                        frame={pickFrame}
                                        turned={phone.sideways}
                                        onTracks={() => feudumSession.layers.openTracks()}
                                    />
                                {/if}
                            </div>
                            <BoardCorner row={phone.phone ? undefined : deskRow} />
                        {/snippet}
                        {#snippet toolbar()}
                            <!-- Full screen is a modal dialog: the panel and all that stands over the table come inside it. -->
                            <div {@attach watchExpansion}>
                                {#if expanded}
                                    {@render turnControls()}
                                    <TableOverlays />
                                {/if}
                            </div>
                        {/snippet}
                    </ScalingWrapper>
                </div>
                {#if phone.upright && !expanded}
                    <SeatStrip />
                {/if}
            </div>
        {/snippet}
    </DefaultTableLayout>
    {#if !expanded}
        <TableOverlays />
    {/if}
</div>

<style>
    .game-stack {
        display: contents;
    }

    /*
     * A desk's board view: its own shape at the column's width, no taller, and shorter where the
     * action area leaves less height; nothing is reserved for the tallest action area.
     */
    .feudum-table:not([data-phone]) .board-view {
        flex: 0 1 auto;
        width: 100%;
        min-height: 0;
    }

    /* The column's height is the action area's measure, in the page and in full screen alike. */
    /* The column is the hand sheet's frame, so it stands from the column's foot. */
    [data-phone] .game-stack {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        container-type: size;
    }

    [data-phone='upright'] .action-cap {
        max-height: 36cqh;
    }

    [data-phone='sideways'] .action-cap {
        max-height: 40cqh;
    }

    [data-phone] .action-cap {
        overflow-x: hidden;
        overflow-y: auto;
    }

    /*
     * The hand draft's bottom sheet: it stands over the board from the column's foot. Once the hand
     * is set it holds only the hand, the sealed pouch and the waiting line, so it is short; it gives
     * the board back at the reveal.
     */
    [data-phone] .action-cap[data-hand-sheet] {
        position: absolute;
        inset-inline: 0;
        bottom: 0;
        z-index: 30;
        max-height: 85cqh;
        border-top: 1px solid var(--feudum-frame);
        border-radius: 0.75rem 0.75rem 0 0;
        background-color: var(--feudum-surface-raised);
    }

    /* Upright, the seat strip stays in sight under the sheet: its 44 px chips open the seats. */
    [data-phone='upright'] .action-cap[data-hand-sheet] {
        bottom: 44px;
    }

    /* Contract, Phone layout: 44 px targets, in the panel, the popups and the sheets' footers. */
    [data-phone] :global(:is([data-action-panel], [data-board-popup], [data-bench-footer]) button) {
        min-height: 44px;
        min-width: 44px;
    }
</style>
