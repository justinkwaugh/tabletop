<script lang="ts">
    import { untrack } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import {
        ScalingWrapper,
        DefaultTableLayout,
        DefaultTabs,
        HistoryControls,
        CustomFont,
        GameSession
    } from '@tabletop/frontend-components'
    import type {
        HydratedPromontoryPointGameState,
        PromontoryPointProjectedState
    } from '@tabletop/promontory-point'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import EnlargedView from '$lib/components/EnlargedView.svelte'
    import FlightLayer from '$lib/components/FlightLayer.svelte'
    import OpenSeat from '$lib/components/OpenSeat.svelte'
    import PickFramingWatch from '$lib/components/PickFramingWatch.svelte'
    import SeatStrip from '$lib/components/SeatStrip.svelte'
    import type { SpaceId } from '@tabletop/promontory-point'
    import {
        HEX_FIELD_RECT,
        PICK_FRAME_PADDING,
        PickFraming,
        litFrameRect,
        pickFrameMaxScale
    } from '$lib/model/boardFraming.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { PromontoryPointGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import Oswald500 from '$lib/fonts/Oswald-500.woff2'
    import Oswald600 from '$lib/fonts/Oswald-600.woff2'
    import Caslon400 from '$lib/fonts/LibreCaslonText-400.woff2'
    import Caslon400Italic from '$lib/fonts/LibreCaslonText-400-italic.woff2'

    let {
        gameSession
    }: {
        gameSession: GameSession<PromontoryPointProjectedState, HydratedPromontoryPointGameState>
    } = $props()

    function ensurePromontoryPointGameSession(
        session: GameSession<PromontoryPointProjectedState, HydratedPromontoryPointGameState>
    ): PromontoryPointGameSession {
        if (session instanceof PromontoryPointGameSession) {
            return session
        }
        throw new Error('GameTable expected an PromontoryPointGameSession')
    }

    setGameSession(untrack(() => ensurePromontoryPointGameSession(gameSession)))
    const session = $derived(ensurePromontoryPointGameSession(gameSession))

    // Contract, "Phone layout": on a phone the board rests on the hex field and a pick frames its
    // lit hexes; a hand pan or zoom clears the framing. A desktop frames nothing.
    const layout = new PhoneLayout()
    let wrapper = $state<ScalingWrapper>()
    let boardWidth = $state(0)
    let boardHeight = $state(0)
    // A fresh framing each time the window becomes a phone.
    const framing = $derived(layout.phone ? new PickFraming() : undefined)

    function framePick(lit: readonly SpaceId[]) {
        const rect = litFrameRect(lit)
        if (!wrapper || !rect) return
        wrapper.focusRect(rect, {
            animate: true,
            maxScale: pickFrameMaxScale({ width: boardWidth, height: boardHeight }),
            padding: PICK_FRAME_PADDING
        })
    }

    function restOnHexField(animate: boolean) {
        wrapper?.focusRect(HEX_FIELD_RECT, { animate, padding: 0 })
    }

    // The shared wrapper exposes full screen only as its dialog becoming modal.
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
</script>

<CustomFont fontFamily="Oswald" url={Oswald500} format="woff2" fontWeight={500} />
<CustomFont fontFamily="Oswald" url={Oswald600} format="woff2" fontWeight={600} />
<CustomFont
    fontFamily="Libre Caslon Text"
    url={Caslon400}
    format="woff2"
    fontWeight={400}
    fontStyle="normal"
/>
<CustomFont
    fontFamily="Libre Caslon Text"
    url={Caslon400Italic}
    format="woff2"
    fontWeight={400}
    fontStyle="italic"
/>

{#snippet playersPanel()}
    <PlayersPanel />
{/snippet}
{#snippet history()}
    <History />
{/snippet}

<!-- The table surround is the olive of the map's hexes; the side column a little darker. -->
<div class="pp-table">
    <DefaultTableLayout>
        {#snippet sideContent()}
            <!-- Composed as the layout guide allows, to restyle the controls and the tabs. -->
            <div class="pp-side">
                <div class="max-sm:hidden">
                    <HistoryControls
                        enabledColor="text-pp-ink"
                        disabledColor="text-pp-paper-line"
                        borderClass="rounded-md shadow-[0_2px_0_var(--pp-halo)]"
                        bgClass="bg-pp-panel"
                        height="h-[40px]"
                    />
                </div>
                <DefaultTabs
                    {playersPanel}
                    {history}
                    fontClass="pp-tab"
                    activeTabClass="py-1 px-3 rounded-md border-2 border-transparent bg-pp-panel text-pp-ink"
                    inactiveTabClass="py-1 px-3 rounded-md border-2 border-transparent text-pp-text hover:border-pp-line"
                />
            </div>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                <ActionPanel />
            </div>
            <div
                class="min-h-[40dvh] grow-0 overflow-hidden max-sm:min-h-[200px]"
                style="flex:1;"
                bind:clientWidth={boardWidth}
                bind:clientHeight={boardHeight}
            >
                <ScalingWrapper
                    bind:this={wrapper}
                    justify="center"
                    controls="bottom-left"
                    expandable
                    maxScale={2}
                    coverBelowScale={0.3}
                    onManualViewChange={() => framing?.handMove(session.boardOffer.lit)}
                >
                    <Board />
                    {#snippet overlay()}
                        {#if framing}
                            <PickFramingWatch
                                lit={session.boardOffer.lit}
                                settling={session.updatingVisibleState}
                                {framing}
                                onframe={framePick}
                                onrest={restOnHexField}
                                onleave={() => wrapper?.fitToContent()}
                            />
                        {/if}
                    {/snippet}
                    {#snippet toolbar()}
                        <!-- Full screen is a modal dialog, so the panel and the enlarged view come inside it. -->
                        <div {@attach watchExpansion}>
                            {#if expanded}
                                <div data-fullscreen-panel>
                                    <ActionPanel />
                                </div>
                                <EnlargedView />
                                <FlightLayer />
                            {/if}
                        </div>
                    {/snippet}
                </ScalingWrapper>
            </div>
            <SeatStrip />
        {/snippet}
    </DefaultTableLayout>
    {#if !expanded}
        <OpenSeat />
        <EnlargedView />
        <FlightLayer />
    {/if}
</div>

<style>
    .pp-table {
        background-color: var(--pp-table);
        background-image: radial-gradient(
            color-mix(in srgb, var(--pp-paper) 4%, transparent) 1px,
            transparent 1px
        );
        background-size: 7px 7px;
    }

    .pp-side {
        display: flex;
        flex-direction: column;
        gap: 8px;
        height: 100%;
        min-height: 0;
        margin: -8px 0 -8px -8px;
        padding: 8px;
        background: var(--pp-column);
    }

    .pp-side :global(.pp-tab) {
        font-family: Oswald, sans-serif;
        font-weight: 500;
        font-size: 15px;
        letter-spacing: 0.03em;
        text-transform: uppercase;
    }
</style>
