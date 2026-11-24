<script lang="ts">
    import { keepWheelIn } from '$lib/utils/wheelKeeper.js'
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
    import GuildSides from '$lib/components/table/GuildSides.svelte'
    import BoardCorner from '$lib/components/table/BoardCorner.svelte'
    import DeskColumn from '$lib/components/table/DeskColumn.svelte'
    import Header from '$lib/components/table/Header.svelte'
    import ScoreLine from '$lib/components/table/ScoreLine.svelte'
    import SeatStrip from '$lib/components/table/SeatStrip.svelte'
    import StatusStrip from '$lib/components/table/StatusStrip.svelte'
    import { setTableLayers } from '$lib/components/table/tableLayersContext.js'
    import TableOverlays from '$lib/components/table/TableOverlays.svelte'
    import { FontFaces } from '$lib/fonts/fonts.js'
    import {
        BoardFocus,
        ChooserInset,
        CoverBelowScale,
        deskColumnBox,
        deskColumnOf,
        deskColumnViewWidth,
        deskMapAtRest,
        deskScaledHeight,
        deskViewHeight,
        litAreasOf,
        restScaleOf,
        ZoomRowBand
    } from '$lib/model/boardFocus.svelte.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { FeudumGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import { MapArea } from '$lib/utils/boardGeometry.js'

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
    let room = $state({ width: 0, height: 0 })
    let expanded = $state(false)

    /** Contract, Shared visual state: never read for an offer. */
    const focus = new BoardFocus({
        view: () => wrapper,
        restScale: () => restScaleOf(viewSize.width, viewSize.height),
        sideways: () => phone.sideways,
        animate: () => !phone.reducedMotion,
        pickFrame: () => feudumSession.pickFrame
    })

    /** Contract, Phone layout: the hand drafts in a bottom sheet, kept once the hand is set. */
    let handSheet = $derived(
        phone.phone &&
            (feudumSession.handPanel?.drafting !== undefined ||
                feudumSession.handPanel?.set !== undefined)
    )

    let seats = $derived(feudumSession.gameState.players.length)

    /** Contract, Desk layout: the room alone decides the column, so each size has one layout. */
    let pageColumn = $derived(
        phone.phone || !(room.width > 0) ? undefined : deskColumnOf(room, seats)
    )
    let column = $derived(
        phone.phone ? undefined : expanded ? deskColumnOf(viewSize, seats) : pageColumn
    )

    /** Contract, Supply: on a desk the zoom row stands under the standings' strip. */
    let deskView = $derived.by(() => {
        if (!(room.width > 0)) {
            return `aspect-ratio:${MapArea.width} / ${deskScaledHeight(seats)}`
        }
        if (pageColumn) {
            return `width:${deskColumnViewWidth(room, seats, pageColumn)}px;height:${room.height}px`
        }
        return `height:${Math.min(deskViewHeight(room.width, seats), room.height)}px`
    })

    let litAreas = $derived(litAreasOf(feudumSession.gameState, feudumSession.boardOffer))

    const measureView: (viewport: HTMLElement) => Attachment<HTMLElement> = (viewport) => () => {
        const read = () => {
            const { clientWidth: width, clientHeight: height } = viewport
            if (width !== viewSize.width || height !== viewSize.height) {
                viewSize = { width, height }
                if (phone.phone) {
                    focus.settle()
                }
            }
        }
        // The next frame: refitting inside the observer's delivery would resize what it watches.
        const observer = new ResizeObserver(() => requestAnimationFrame(read))
        observer.observe(viewport)
        read()
        return () => observer.disconnect()
    }

    const measureRoom: Attachment<HTMLElement> = (node) => {
        const read = () => {
            const box = node.getBoundingClientRect()
            const width = Math.floor(box.width)
            const height = Math.floor(box.height)
            if (width !== room.width || height !== room.height) {
                room = { width, height }
            }
        }
        const observer = new ResizeObserver(() => requestAnimationFrame(read))
        observer.observe(node)
        read()
        return () => observer.disconnect()
    }

    const keepWheelInColumn = keepWheelIn('[data-desk-column]')

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

    /** Contract, Desk layout */
    let deskRest = $derived(deskMapAtRest(viewSize, seats, expanded, column))

    /** Contract, Coexistence and precedence: Escape closes a layer before full screen. */
    function onEscape(event: KeyboardEvent) {
        if (event.key === 'Escape' && feudumSession.layers.escape(expanded)) {
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
    <!-- Contract, Supply: the desk's zoom row ends with the scores. -->
    <ScoreLine />
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
                <div class="board-room" {@attach measureRoom} data-board-room>
                    <div
                        class="board-view relative grow-0 overflow-hidden"
                        style={phone.phone ? 'flex:1;' : deskView}
                        data-board-view
                        data-desk-layout={phone.phone ? undefined : column ? 'column' : 'strip'}
                    >
                        <ScalingWrapper
                            bind:this={wrapper}
                            justify={phone.phone ? 'center' : 'left'}
                            controls={column ? 'bottom-right' : 'bottom-left'}
                            coverBelowScale={CoverBelowScale}
                            insetTop={phone.phone ? ChooserInset : 0}
                            expandable
                            renderAtViewScale
                            onManualViewChange={() => focus.handMoved()}
                        >
                            <div
                                style:padding-left={phone.phone
                                    ? undefined
                                    : `${deskRest.gutter}px`}
                                style:padding-right={phone.phone
                                    ? undefined
                                    : `${deskRest.trail}px`}
                                data-board-content
                            >
                                <Board
                                    desk={!phone.phone}
                                    rails={phone.phone
                                        ? focus.shown === 'west' || focus.shown === 'east'
                                            ? focus.shown
                                            : undefined
                                        : column
                                          ? undefined
                                          : 'strip'}
                                />
                                {#if !column}
                                    <div
                                        class="block"
                                        style:height="{ZoomRowBand}px"
                                        data-zoom-row-band
                                    ></div>
                                {/if}
                            </div>
                            {#snippet overlay(viewport)}
                                <div
                                    class="contents"
                                    {@attach measureView(viewport)}
                                    onwheel={keepWheelInColumn}
                                >
                                    {#if phone.phone}
                                        <FocusChooser
                                            {focus}
                                            lit={litAreas}
                                            turned={phone.sideways}
                                            onTracks={() => feudumSession.layers.openTracks()}
                                        />
                                    {:else}
                                        <GuildSides rest={deskRest} lit={litAreas} />
                                        {#if column}
                                            <DeskColumn
                                                box={deskColumnBox(viewSize, column)}
                                                {column}
                                            />
                                        {/if}
                                    {/if}
                                </div>
                                <BoardCorner
                                    row={phone.phone || column ? undefined : deskRow}
                                    end={column !== undefined}
                                />
                            {/snippet}
                            {#snippet toolbar()}
                                <div {@attach watchExpansion}>
                                    {#if expanded}
                                        {@render turnControls()}
                                        <TableOverlays />
                                    {/if}
                                </div>
                            {/snippet}
                        </ScalingWrapper>
                    </div>
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

    .feudum-table:not([data-phone]) .board-room {
        flex: 1 1 0;
        width: 100%;
        min-height: 0;
    }

    .feudum-table:not([data-phone]) .board-view {
        width: 100%;
    }

    [data-phone] .board-room {
        display: contents;
    }

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

    [data-phone='upright'] .action-cap[data-hand-sheet] {
        bottom: 44px;
    }

    /* Contract, Phone layout: 44 px targets, in the panel, the popups and the sheets' footers. */
    [data-phone] :global(:is([data-action-panel], [data-board-popup], [data-bench-footer]) button) {
        min-height: 44px;
        min-width: 44px;
    }
</style>
