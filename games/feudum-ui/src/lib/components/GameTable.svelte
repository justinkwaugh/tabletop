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
    import SymbolKey from '$lib/components/table/SymbolKey.svelte'
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
        litAreasOf,
        pickFrameOf,
        restScaleOf
    } from '$lib/model/boardFocus.svelte.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { FeudumGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

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

    /** Contract, Board focus: never read for an offer, and a desktop has no chooser and no framing. */
    const focus = new BoardFocus({
        view: () => wrapper,
        restScale: () => restScaleOf(viewSize.width, viewSize.height),
        sideways: () => phone.sideways,
        animate: () => !phone.reducedMotion
    })

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

{#snippet turnControls()}
    <div class="bg-feudum-surface" data-turn-controls>
        <Header />
        {#if phone.upright}
            <StatusStrip />
        {/if}
        <div class="action-cap" data-action-cap inert={feudumSession.updatingVisibleState}>
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
                <div class="relative grow-0 overflow-hidden" style="flex:1;" data-board-view>
                    <ScalingWrapper
                        bind:this={wrapper}
                        justify="center"
                        controls="bottom-left"
                        coverBelowScale={CoverBelowScale}
                        insetTop={phone.phone ? ChooserInset : 0}
                        expandable
                        onManualViewChange={() => focus.handMoved()}
                    >
                        <Board />
                        {#snippet overlay(viewport)}
                            {#if phone.phone}
                                <div class="contents" {@attach measureView(viewport)}>
                                    <FocusChooser
                                        {focus}
                                        lit={litAreas}
                                        frame={pickFrame}
                                        turned={phone.sideways}
                                        onTracks={() => feudumSession.layers.openTracks()}
                                    />
                                </div>
                            {/if}
                            <SymbolKey />
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

    /* The column's height is the action area's measure, in the page and in full screen alike. */
    [data-phone] .game-stack {
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

    /* Contract, Phone layout: 44 px targets, in the panel, the popups and the sheets' footers. */
    [data-phone] :global(:is([data-action-panel], [data-board-popup], [data-bench-footer]) button) {
        min-height: 44px;
        min-width: 44px;
    }
</style>
