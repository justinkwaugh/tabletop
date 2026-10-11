<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import {
        ScalingWrapper,
        DefaultTableLayout,
        GameSession,
        GameChat,
        CustomFont,
        HistoryControls,
        DefaultTabs
    } from '@tabletop/frontend-components'
    import { assert } from '@tabletop/common'
    import { boardLayout } from '$lib/utils/boardLayout.js'
    import type {
        HydratedStellarHorizonsGameState,
        StellarHorizonsProjectedState
    } from '@tabletop/stellar-horizons-2'
    import { TECH_FIELDS, TurnStep, type TechField } from '@tabletop/stellar-horizons-2'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionCard from '$lib/components/ActionCard.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import TechTree from '$lib/components/TechTree.svelte'
    import SystemPanel from '$lib/components/SystemPanel.svelte'
    import FactionSheet from '$lib/components/prototype/playerArea/FactionSheet.svelte'
    import { playerArea } from '$lib/components/prototype/playerArea/campaignMock.svelte.js'
    import { fly } from 'svelte/transition'
    import { cubicInOut } from 'svelte/easing'
    import { untrack } from 'svelte'
    import { MediaQuery } from 'svelte/reactivity'
    import { StellarHorizonsGameSession } from '$lib/model/session.svelte'
    import { getGameSession, setGameSession } from '$lib/model/sessionContext.svelte'
    import HindDigitsFont from '$lib/fonts/Hind-Bold-digits.woff2'

    let {
        gameSession
    }: {
        gameSession: GameSession<StellarHorizonsProjectedState, HydratedStellarHorizonsGameState>
    } = $props()
    assert(
        gameSession instanceof StellarHorizonsGameSession,
        'Stellar Horizons needs its own game session'
    )
    setGameSession(gameSession)
    const session = getGameSession()

    type TableView = 'map' | 'techs'
    const paneLayout = new MediaQuery('(min-width: 64rem)')
    const mapOverpan = $derived(paneLayout.current ? 'both' : 'focus')
    let chosenView: { step: TurnStep | undefined; view: TableView } | undefined = $state()
    const view: TableView = $derived(
        chosenView && chosenView.step === session.actingStep
            ? chosenView.view
            : session.actingStep === TurnStep.Development
              ? 'techs'
              : 'map'
    )

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

    let techFocus: TechField | undefined = $state()

    const FOCUS_MS = 650
    const FOCUS_PADDING = 12
    const SHEET_BELOW_WIDTH = 640
    const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)')
    const focusDuration = $derived(reducedMotion.current ? 0 : FOCUS_MS)

    let mapWrapper: ScalingWrapper | undefined = $state()
    let mapAreaWidth = $state(0)
    let mapAreaHeight = $state(0)
    let windowWidth = $state(0)
    let windowHeight = $state(0)
    let controlsHeight = $state(0)
    const focusArea = $derived(
        expanded
            ? { width: windowWidth, height: windowHeight - controlsHeight }
            : { width: mapAreaWidth, height: mapAreaHeight }
    )
    const sheet = $derived(focusArea.width < SHEET_BELOW_WIDTH)
    const panelSize = $derived(
        sheet
            ? Math.round(focusArea.height * 0.45)
            : Math.round(Math.min(400, Math.max(320, focusArea.width * 0.32)))
    )
    const focusRect = $derived.by(() => {
        const frame = boardLayout(
            session.gameState.systems.map((system) => system.systemId)
        ).frames.find((candidate) => candidate.systemId === session.focusedSystemId)
        return frame
            ? {
                  x: frame.center.x - frame.width / 2,
                  y: frame.center.y - frame.height / 2,
                  width: frame.width,
                  height: frame.height
              }
            : undefined
    })

    // The view before zooming in, restored on the way out. A map shown while already zoomed
    // (after the tech chart) has no earlier view, so it fits the whole map instead.
    let restoreMapView: { wrapper: ScalingWrapper; restore: () => void } | undefined
    let mountedWhileFocused = false

    $effect(() => {
        const wrapper = mapWrapper
        untrack(() => {
            mountedWhileFocused = !!wrapper && !!session.focusedSystemId
        })
    })

    $effect(() => {
        const wrapper = mapWrapper
        const rect = focusRect
        const closing = session.focusClosing
        const inset = panelSize
        const inSheet = sheet
        if (!wrapper || !rect || closing) return
        untrack(() => {
            if (!restoreMapView && !mountedWhileFocused) {
                const restore = wrapper.captureView()
                restoreMapView = {
                    wrapper,
                    restore: () => restore({ animate: true, duration: focusDuration })
                }
            }
            wrapper.focusRect(rect, {
                animate: true,
                duration: focusDuration,
                maxScale: 2,
                padding: FOCUS_PADDING,
                insetRight: inSheet ? 0 : inset,
                insetBottom: inSheet ? inset : 0
            })
        })
    })

    $effect(() => {
        const wrapper = mapWrapper
        if (!wrapper || !session.focusClosing) return
        const timer = untrack(() => {
            if (restoreMapView?.wrapper === wrapper) {
                restoreMapView.restore()
            } else {
                wrapper.fitToContent({ animate: true, duration: focusDuration })
            }
            restoreMapView = undefined
            return setTimeout(() => {
                mountedWhileFocused = false
                session.finishLeavingFocus()
            }, focusDuration)
        })
        return () => clearTimeout(timer)
    })

    function choose(next: TableView) {
        chosenView = { step: session.actingStep, view: next }
    }
</script>

{#snippet fullscreenControls()}
    <div {@attach watchExpansion} bind:clientHeight={controlsHeight}>
        {#if expanded}
            <div class="fullscreen-controls">
                {@render turnControls()}
            </div>
        {/if}
    </div>
{/snippet}

{#snippet actionCard()}
    <ActionCard>
        {#if session.gameState.result}
            <GameEndPanel />
        {:else}
            <ActionPanel />
        {/if}
    </ActionCard>
{/snippet}

{#snippet turnControls()}
    <Header />
    {@render actionCard()}
{/snippet}

<svelte:window bind:innerWidth={windowWidth} bind:innerHeight={windowHeight} />

<CustomFont fontFamily="Hind Digits" url={HindDigitsFont} format="woff2" fontWeight="700" />

<div class="table-surface">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#dbe7f5]"
                disabledColor="text-[#3d4a63]"
                borderClass="border-[#2a3a57] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls enabledColor="text-[#dbe7f5]" disabledColor="text-[#3d4a63]" />
            </div>
            <DefaultTabs
                playersTitle="Factions"
                activeTabClass="py-1 px-3 bg-[#7fd3ff] border-2 border-transparent rounded-lg text-[#05070d]"
                inactiveTabClass="text-[#7fd3ff] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#7fd3ff]"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-gray-500"
                        bgColor="bg-black"
                        inputBgColor="bg-black"
                        inputBorderColor="border-gray-500"
                        borderColor="border-gray-500"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="masthead"><Header /></div>
            <div class="game-scroll">
                <div class="shrink-0">
                    {@render actionCard()}
                    <div class="view-toggle">
                        <button
                            type="button"
                            class:active={view === 'map'}
                            onclick={() => choose('map')}>Star map</button
                        >
                        <button
                            type="button"
                            class:active={view === 'techs'}
                            onclick={() => choose('techs')}>Tech chart</button
                        >
                        {#if view === 'techs'}
                            <span class="divider"></span>
                            <button
                                type="button"
                                class:active={techFocus === undefined}
                                onclick={() => (techFocus = undefined)}>All</button
                            >
                            {#each TECH_FIELDS as field (field)}
                                <button
                                    type="button"
                                    class:active={techFocus === field}
                                    onclick={() => (techFocus = field)}>{field}</button
                                >
                            {/each}
                        {/if}
                    </div>
                </div>
                <div class="grow-0 overflow-hidden pt-2" style="flex:1; min-height: 40dvh;">
                    {#if view === 'map'}
                        <div class="map-stack">
                            <div
                                class="map-area"
                                bind:clientWidth={mapAreaWidth}
                                bind:clientHeight={mapAreaHeight}
                            >
                                <ScalingWrapper
                                    bind:this={mapWrapper}
                                    justify="center"
                                    controls="bottom-left"
                                    expandable
                                    maxScale={2}
                                    overpan={mapOverpan}
                                >
                                    <Board />
                                    {#snippet toolbar()}
                                        {@render fullscreenControls()}
                                        {#if session.focusedSystemId && !session.focusClosing}
                                            <div
                                                class="focus-panel"
                                                class:sheet
                                                style:top={sheet
                                                    ? 'auto'
                                                    : `${expanded ? controlsHeight : 0}px`}
                                                style:width={sheet ? '100%' : `${panelSize}px`}
                                                style:height={sheet ? `${panelSize}px` : 'auto'}
                                                transition:fly={{
                                                    x: sheet ? 0 : panelSize,
                                                    y: sheet ? panelSize : 0,
                                                    opacity: 1,
                                                    duration: focusDuration,
                                                    easing: cubicInOut
                                                }}
                                            >
                                                <SystemPanel systemId={session.focusedSystemId} />
                                            </div>
                                        {/if}
                                    {/snippet}
                                </ScalingWrapper>
                            </div>
                            {#if playerArea.sheetUnderMap}
                                <div class="faction-sheet"><FactionSheet /></div>
                            {/if}
                        </div>
                    {:else}
                        <ScalingWrapper justify="center" controls="bottom-left" expandable>
                            <TechTree focus={techFocus} />
                            {#snippet toolbar()}
                                {@render fullscreenControls()}
                            {/snippet}
                        </ScalingWrapper>
                    {/if}
                </div>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .table-surface {
        background: #070b14;
        color: #dbe7f5;
    }

    /* The turn header sits outside the scrolling area, so it never moves with it. */
    .masthead {
        flex-shrink: 0;
    }

    .game-scroll {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        min-height: 0;
        overflow: auto;
    }

    .view-toggle {
        display: flex;
        justify-content: center;
        gap: 6px;
        padding-top: 8px;
    }

    .view-toggle button {
        border: 1px solid #2a3a57;
        border-radius: 999px;
        padding: 2px 14px;
        font-size: 14px;
        letter-spacing: 0.06em;
        color: #9fb4d0;
    }

    .view-toggle button.active {
        background: #7fd3ff;
        border-color: #7fd3ff;
        color: #05070d;
    }

    .divider {
        width: 1px;
        background: #2a3a57;
        margin: 0 6px;
    }

    .map-stack {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .map-area {
        position: relative;
        flex: 1;
        min-height: 0;
    }

    .faction-sheet {
        position: relative;
        flex-shrink: 0;
        z-index: 3;
    }

    .focus-panel {
        position: absolute;
        right: 0;
        bottom: 0;
        z-index: 2;
        cursor: auto;
        user-select: text;
    }

    .focus-panel.sheet {
        left: 0;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
        background: #070b14;
    }

    /* In the table the action card grows with its content and the game area scrolls, with the
       map keeping its minimum height. Full screen has no scrolling, so the card is capped. */
    .fullscreen-controls :global(.card) {
        max-height: 34dvh;
        overflow-y: auto;
    }
</style>
