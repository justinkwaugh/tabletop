<script lang="ts">
    import {
        ScalingWrapper,
        DefaultTableLayout,
        CustomFont,
        GameSession,
        type GameStateChangeListener,
        GameChat,
        HistoryControls,
        DefaultTabs
    } from '@tabletop/frontend-components'
    import { assert } from '@tabletop/common'
    import { onMount, tick, untrack } from 'svelte'
    import type {
        HydratedNapoleonsTriumphGameState,
        NapoleonsTriumphProjectedState
    } from '@tabletop/napoleons-triumph'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import BattlePanel from '$lib/components/BattlePanel.svelte'
    import SetupPanel from '$lib/components/SetupPanel.svelte'
    import AuctionPanel from '$lib/components/AuctionPanel.svelte'
    import ArmiesPanel from '$lib/components/ArmiesPanel.svelte'
    import History from '$lib/components/History.svelte'
    import { NapoleonsTriumphGameSession } from '$lib/model/session.svelte'
    import type { GroupSprite, PieceGroup } from '$lib/utils/pieceLayout.js'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import MapMenu from '$lib/components/MapMenu.svelte'
    import MoveReplay from '$lib/components/MoveReplay.svelte'
    import { LOCALE_GEOMETRY } from '$lib/map/boardGeometry.js'
    import { battleLocalesOf } from '$lib/model/battleStage.js'
    import { blockCorners } from '$lib/utils/blockShape.js'
    import { boundsOf, nextView, viewFor } from '$lib/utils/boardView.js'
    import { commandTrackCorners } from '$lib/utils/commandTrack.js'
    import LibreBaskervilleFont from '$lib/fonts/LibreBaskerville.woff2'
    import LibreBaskervilleItalicFont from '$lib/fonts/LibreBaskerville-Italic.woff2'

    let {
        gameSession
    }: {
        gameSession: GameSession<NapoleonsTriumphProjectedState, HydratedNapoleonsTriumphGameState>
    } = $props()
    const session = untrack(() => {
        assert(
            gameSession instanceof NapoleonsTriumphGameSession,
            "Napoleon's Triumph needs its own game session"
        )
        return gameSession
    })
    setGameSession(session)

    let wrapper: ScalingWrapper | undefined = $state()
    let restoreView: ReturnType<ScalingWrapper['captureView']> | undefined
    let boardHost: HTMLElement | undefined = $state()
    let table: HTMLElement | undefined = $state()
    let ordersDrawerHeight = $state(0)
    const boardCovered = $derived(
        session.isCommanding && session.selectedGroup ? ordersDrawerHeight : 0
    )

    const turnColour = $derived.by(() => {
        const [activePlayerId] = session.gameState.activePlayerIds
        const hasArmy =
            activePlayerId !== undefined &&
            session.gameState.findPlayerState(activePlayerId)?.side !== undefined
        return hasArmy && !session.isViewingHistory && !session.gameState.result
            ? session.armyColors(activePlayerId).block
            : undefined
    })

    const BATTLE_FOCUS = { maxScale: 1.15, padding: 36 }
    const SELECTION_FOCUS_BELOW_ZOOM = 0.3
    const SELECTION_FOCUS = { maxScale: 0.62, padding: 24 }

    function outlines(locales: number[]) {
        return locales.flatMap((locale) => LOCALE_GEOMETRY[locale]?.outline ?? [])
    }

    const LOCATE_FOCUS = { maxScale: 0.85, padding: 28 }

    function showOnMap(locale: number) {
        if (!wrapper) return
        restoreView = undefined
        const surroundings = [locale, ...session.gameState.map.adjacentLocales(locale)]
        wrapper.focusRect(boundsOf(outlines(surroundings), session.boardRotation), {
            animate: true,
            ...LOCATE_FOCUS
        })
        boardHost?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }

    const TRACK_FOCUS = { maxScale: 0.85, padding: 40 }

    function showCommandTrack() {
        const side = session.mySide
        if (!wrapper || !side) return
        restoreView = undefined
        wrapper.focusRect(boundsOf(commandTrackCorners(side), session.boardRotation), {
            animate: true,
            ...TRACK_FOCUS
        })
    }

    const UNCOVERED_PADDING = 60

    function showBattle(locales: number[], animate: boolean) {
        if (!wrapper) return
        if (locales.length === 0) {
            restoreView?.({ animate })
            restoreView = undefined
            return
        }
        restoreView ??= wrapper.captureView()
        wrapper.focusRect(boundsOf(outlines(locales), session.boardRotation), {
            animate,
            ...BATTLE_FOCUS
        })
    }

    function showWholeFieldPick(group: PieceGroup, animate: boolean) {
        const locales = [
            ...(group.position ? [group.position.locale] : []),
            ...session.targets.map((target) => target.position.locale)
        ]
        const points = outlines(locales)
        if (points.length > 0) {
            wrapper?.focusRect(boundsOf(points, session.boardRotation), {
                animate,
                ...SELECTION_FOCUS
            })
        }
    }

    // The orders sheet hangs over the top of the board, so pieces picked up beneath it are brought out from under it at the zoom the board already has.
    function uncover(sprite: GroupSprite, sheet: Element, animate: boolean) {
        const pieces = boardHost?.querySelector(`[data-group="${CSS.escape(sprite.group.key)}"]`)
        if (pieces && pieces.getBoundingClientRect().top < sheet.getBoundingClientRect().bottom) {
            wrapper?.focusRect(
                boundsOf(sprite.blocks.flatMap(blockCorners), session.boardRotation),
                { animate, maxScale: session.zoom, padding: UNCOVERED_PADDING }
            )
        }
    }

    async function showPickedUp(animate: boolean) {
        await tick()
        const group = session.selectedGroup
        if (!group) return
        const sheet = table?.querySelector('.nt-orders-drawer')
        if (sheet) {
            ordersDrawerHeight = sheet.clientHeight
            await tick()
        }
        if (session.zoom < SELECTION_FOCUS_BELOW_ZOOM) {
            showWholeFieldPick(group, animate)
        } else if (sheet && session.selectedSprite) {
            uncover(session.selectedSprite, sheet, animate)
        }
    }

    async function turnBoard() {
        session.boardView = nextView(session.boardView)
        await tick()
        if (session.battleLocales.length > 0) {
            showBattle(session.battleLocales, false)
        }
    }

    // A committed action animates the view to and from a battle; Undo, history steps and restores cut to it.
    const followGame: GameStateChangeListener<HydratedNapoleonsTriumphGameState> = async ({
        from,
        to,
        action,
        animationContext
    }) => {
        const before = from ? battleLocalesOf(from) : []
        const after = battleLocalesOf(to)
        if (before.join() !== after.join()) {
            animationContext.afterAnimations(() => showBattle(after, action !== undefined))
        }
        if (to.roadMarch && !from?.roadMarch) {
            animationContext.afterAnimations(() => void showPickedUp(action !== undefined))
        }
    }

    // The armies sit along the long sides of the board (rule 4 map), so a wide screen opens turned to the viewer's side.
    onMount(() => {
        if (window.innerWidth > window.innerHeight) {
            session.boardView = viewFor(session.mySide)
        }
        showBattle(session.battleLocales, false)
        session.addGameStateChangeListener(followGame)
        const stopListening = session.onPickUp(() => void showPickedUp(true))
        const stopReadingZoom = session.readZoomFrom(() => wrapper?.viewScale())
        return () => {
            session.removeGameStateChangeListener(followGame)
            stopListening()
            stopReadingZoom()
        }
    })
</script>

<CustomFont
    fontFamily="Libre Baskerville"
    url={LibreBaskervilleFont}
    format="woff2"
    fontWeight="400 700"
/>
<CustomFont
    fontFamily="Libre Baskerville"
    url={LibreBaskervilleItalicFont}
    format="woff2"
    fontWeight="400 700"
    fontStyle="italic"
/>

<div class="nt-table bg-[#e9e6dc]" bind:this={table}>
    <DefaultTableLayout topPadding={0} horizontalPadding={0}>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#2b2620]"
                disabledColor="text-[#b9b3a4]"
                borderClass="border-[#2b2620] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="nt-side">
                <div class="max-sm:hidden">
                    <HistoryControls
                        enabledColor="text-[#2b2620]"
                        disabledColor="text-[#b9b3a4]"
                        borderClass="rounded-lg border-2 border-[#2b2620]"
                    />
                </div>
                <DefaultTabs
                    playersTitle="Armies"
                    activeTabClass="py-1 px-2 bg-[#2b2620] border-2 border-transparent rounded-lg text-[#f1ecdc]"
                    inactiveTabClass="text-[#2b2620] py-1 px-2 rounded-lg border-2 border-transparent hover:border-[#2b2620]"
                >
                    {#snippet playersPanel()}
                        <ArmiesPanel onlocate={showOnMap} />
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
            </div>
        {/snippet}
        {#snippet gameContent()}
            <fieldset
                class="nt-turn min-w-0 shrink-0"
                style:--nt-turn-colour={turnColour}
                disabled={session.busy}
            >
                <Header />
                <div class="nt-turn-body">
                    {#if session.isViewingHistory}
                        <ActionPanel bind:ordersDrawerHeight />
                    {:else if session.attack}
                        <BattlePanel />
                    {:else if session.isAuction}
                        <AuctionPanel />
                    {:else if session.isDeploying}
                        <SetupPanel />
                    {:else}
                        <ActionPanel bind:ordersDrawerHeight />
                    {/if}
                </div>
            </fieldset>
            <div
                class="grow-0 overflow-hidden"
                style="flex:1; min-height: 40dvh;"
                bind:this={boardHost}
            >
                <ScalingWrapper
                    bind:this={wrapper}
                    justify="center"
                    controls="bottom-left"
                    expandable
                    maxScale={1.4}
                    insetTop={boardCovered}
                    coverBelowScale={0.4}
                    onManualViewChange={() => (restoreView = undefined)}
                >
                    <Board />
                    {#snippet overlay()}
                        <MapMenu onshowcommandtrack={showCommandTrack} onturn={turnBoard} />
                    {/snippet}
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
    <MoveReplay />
</div>

<style>
    .nt-table {
        font-family: 'Libre Baskerville', Georgia, serif;
        --nt-ink: #2b2620;
        --nt-ground: #e9e6dc;
        --nt-warn: #7a1418;
        --nt-hover: rgba(43, 38, 32, 0.08);
        --nt-move-fill: rgba(246, 222, 120, 0.3);
        --nt-move-line: #8a6a12;
        --nt-road-fill: rgba(190, 150, 110, 0.24);
        --nt-road-line: #6d4a2a;
        --nt-approach-fill: rgba(246, 222, 120, 0.55);
    }

    /* Restores to the side panel the gaps given up by zeroing DefaultTableLayout's padding. */
    .nt-side {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        box-sizing: border-box;
        height: 100%;
        min-height: 0;
        padding: 8px 0 0 8px;
    }

    .nt-turn {
        --nt-ground: #f9f6ee;
        background: var(--nt-ground);
        color: var(--nt-ink);
    }

    .nt-turn-body {
        --nt-body-inline: 16px;
        padding: 6px var(--nt-body-inline) 11px;
    }

    @media (max-width: 639px) {
        .nt-turn-body {
            --nt-body-inline: 6px;
            padding: 4px var(--nt-body-inline) 6px;
        }
    }

    .nt-table :global(.nt-plain-button) {
        border: 1px solid var(--nt-ink);
        border-radius: 3px;
        padding: 0.15rem 0.65rem;
        color: var(--nt-ink);
        background: transparent;
    }

    .nt-table :global(.nt-plain-button:hover:not(:disabled):not([aria-pressed='true'])) {
        background: var(--nt-hover);
    }

    .nt-table :global(.nt-plain-button[aria-pressed='true']) {
        background: var(--nt-ink);
        color: var(--nt-ground);
    }
</style>
