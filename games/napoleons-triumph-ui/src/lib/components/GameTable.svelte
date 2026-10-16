<script lang="ts">
    import {
        ScalingWrapper,
        DefaultTableLayout,
        CustomFont,
        GameSession,
        type GameStateChangeListener,
        GameChat,
        HistoryControls,
        DefaultTabs,
        saveToDevice
    } from '@tabletop/frontend-components'
    import { assert, type Point } from '@tabletop/common'
    import { onMount, tick, untrack } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import {
        Side,
        type HydratedNapoleonsTriumphGameState,
        type NapoleonsTriumphProjectedState
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
    import {
        boundsOf,
        focusWhereSeen,
        viewFor,
        type BoardView,
        type Focus
    } from '$lib/utils/boardView.js'
    import { boardPicture, boardPictureName, picturedLayers } from '$lib/utils/boardPicture.js'
    import boardArt from '$lib/images/board.webp'
    import setupMarks from '$lib/images/setup-marks.webp'
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

    const MAP_MENU_ROOM = 96
    let mapMenuTop = $state(0)

    // The orders sheet hangs over the board from the action area above it, so how far down the board
    // it reaches can only be measured. The map menu goes under the sheet, and under the legend too
    // where the legend runs across to the menu's corner.
    $effect(() => {
        const sheet = boardCovered > 0 ? table?.querySelector('.nt-orders-sheet') : undefined
        if (!sheet || !boardHost) {
            mapMenuTop = 0
            return
        }
        const host = boardHost.getBoundingClientRect()
        const key = table?.querySelector('.nt-orders-key')?.getBoundingClientRect()
        const besideTheKey = !key || key.right < host.right - MAP_MENU_ROOM
        const covered = besideTheKey ? sheet.getBoundingClientRect().bottom : key.bottom
        mapMenuTop = Math.max(0, covered - host.top)
    })

    // A new step opens at its prompt, wherever the step before it was scrolled to.
    const openAtTheTop: Attachment<HTMLElement> = (scroller) => {
        void session.gameState.machineState
        void session.gameState.activePlayerIds[0]
        scroller.scrollTop = 0
    }

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

    const UNCOVERED_PADDING = 60

    // A view can only be gone back to if it was taken before the battle and the board has not been
    // turned since. Where there is none, the battle ends on the whole board.
    // Workaround: the wrapper drops a fit it is still animating when the map area changes size, as
    // it does when the battle panel closes, so this one is cut to.
    function returnToTheWholeBoard() {
        restoreView = () => wrapper?.fitToContent()
    }

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

    function panAtThisZoom(points: Point[], animate: boolean) {
        wrapper?.focusRect(boundsOf(points, session.boardRotation), {
            animate,
            maxScale: session.zoom,
            padding: UNCOVERED_PADDING
        })
    }

    // The orders sheet hangs over the top of the board, so pieces picked up beneath it are brought out from under it at the zoom the board already has.
    function uncover(sprite: GroupSprite, sheet: Element, animate: boolean) {
        const pieces = boardHost?.querySelector(`[data-group="${CSS.escape(sprite.group.key)}"]`)
        if (pieces && pieces.getBoundingClientRect().top < sheet.getBoundingClientRect().bottom) {
            panAtThisZoom(sprite.blocks.flatMap(blockCorners), animate)
        }
    }

    const SETUP_FOCUS = { maxScale: 0.62, padding: 40 }
    const SEAT_FOCUS = { maxScale: 0.8, padding: 36 }

    // On a small screen the panel above the map is tall and the map's lower part is below the fold, so a set-up focus is aimed at the part of the map on screen.
    function focusWhereSeenOnSetup(locales: number[], focus: Focus, animate: boolean) {
        if (!boardHost || locales.length === 0) return
        const host = boardHost.getBoundingClientRect()
        const seenHeight = Math.min(host.bottom, window.innerHeight) - host.top
        const { rect, ...where } = focusWhereSeen(
            boundsOf(outlines(locales), session.boardRotation),
            { width: host.width, height: host.height, seenHeight },
            focus
        )
        wrapper?.focusRect(rect, { animate, ...where })
    }

    function showSetupArea(animate: boolean) {
        focusWhereSeenOnSetup(
            session.setupLocales.map((entry) => entry.locale),
            SETUP_FOCUS,
            animate
        )
    }

    // A phone held either way: narrower than the styles' small-screen width, or as short as one lying on its side.
    const SMALL_SCREEN = '(max-width: 639px), (max-height: 539px)'

    function localeOfOpenSeat(): number | undefined {
        const battery = session.setupTable?.fixedBattery
        return (
            session.setupLocales.find((entry) => entry.open)?.locale ??
            (battery?.open ? battery.position?.locale : undefined)
        )
    }

    function closeInOnOpenSeat(animate: boolean) {
        const locale = localeOfOpenSeat()
        if (locale === undefined) {
            showSetupArea(animate)
        } else {
            focusWhereSeenOnSetup(
                [locale, ...session.gameState.map.adjacentLocales(locale)],
                SEAT_FOCUS,
                animate
            )
        }
    }

    function panToOpenCorpsIfOutOfView(animate: boolean) {
        const open = session.setupLocales.find((entry) => entry.open)
        const shape =
            open &&
            boardHost?.querySelector(`[data-setup-locale="${CSS.escape(open.commanderId)}"]`)
        if (!open || !shape || !boardHost) return
        const at = shape.getBoundingClientRect()
        const view = boardHost.getBoundingClientRect()
        const inView =
            at.left >= view.left &&
            at.right <= view.right &&
            at.top >= view.top &&
            at.bottom <= view.bottom
        if (!inView) {
            panAtThisZoom(outlines([open.locale]), animate)
        }
    }

    // A wide screen already shows the whole set-up area, so there the view is not closed in on a seat.
    async function showOpenSeat(animate: boolean) {
        await tick()
        if (window.matchMedia(SMALL_SCREEN).matches) {
            closeInOnOpenSeat(animate)
        } else {
            panToOpenCorpsIfOutOfView(animate)
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

    let savingPicture = $state(false)

    // The copy is taken in the same turn of the page as the faces are covered and shown again, so the board on screen never shows without them.
    async function piecesForPicture(board: SVGSVGElement, showsUnitTypes: boolean) {
        if (showsUnitTypes) {
            return picturedLayers(board)
        }
        session.coverFacesOnTheMap(true)
        try {
            await tick()
            return picturedLayers(board)
        } finally {
            session.coverFacesOnTheMap(false)
        }
    }

    async function savePicture() {
        const board = boardHost?.querySelector('svg[data-board]')
        if (savingPicture || !(board instanceof SVGSVGElement)) return
        savingPicture = true
        try {
            const showsUnitTypes = session.pictureShowsUnitTypes
            const picture = await boardPicture({
                pieces: await piecesForPicture(board, showsUnitTypes),
                artUrls: session.settingUp ? [boardArt, setupMarks] : [boardArt],
                fonts: [
                    { url: LibreBaskervilleFont, style: 'normal' },
                    { url: LibreBaskervilleItalicFont, style: 'italic' }
                ],
                rotation: session.boardRotation
            })
            saveToDevice(picture, boardPictureName(session.gameState, showsUnitTypes))
        } finally {
            savingPicture = false
        }
    }

    async function turnBoardTo(view: BoardView) {
        session.boardView = view
        await tick()
        if (session.battleLocales.length > 0) {
            returnToTheWholeBoard()
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
        if (to.machineState !== from?.machineState) {
            animationContext.afterAnimations(() => void showSetup())
        }
    }

    let setupShownFor: string | undefined

    // At one table the second army's set-up follows the first's at once, so the opening view is shown once per player.
    async function showSetup() {
        await tick()
        const deploying = session.isDeploying ? session.myPlayerId : undefined
        if (deploying === undefined) {
            if (setupShownFor !== undefined) {
                setupShownFor = undefined
                wrapper?.fitToContent()
            }
        } else if (setupShownFor !== deploying && session.setupLocales.length > 0) {
            setupShownFor = deploying
            showSetupArea(false)
        }
    }

    // The armies sit along the long sides of the board (rule 4 map), so a wide screen opens turned to the viewer's side.
    onMount(() => {
        if (window.innerWidth > window.innerHeight) {
            session.boardView = viewFor(session.mySide)
        }
        if (session.battleLocales.length > 0) {
            returnToTheWholeBoard()
        }
        showBattle(session.battleLocales, false)
        void showSetup()
        session.addGameStateChangeListener(followGame)
        const stopListening = session.onPickUp(() => void showPickedUp(true))
        const stopFollowingSeats = session.onSeatOpened(() => void showOpenSeat(true))
        const stopReadingZoom = session.readZoomFrom(() => wrapper?.viewScale())
        return () => {
            session.removeGameStateChangeListener(followGame)
            stopListening()
            stopFollowingSeats()
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

<div
    class="nt-table bg-[#e9e6dc]"
    class:nt-french-ways={session.mySide === Side.French}
    bind:this={table}
>
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
            <div class="nt-column" style:--nt-turn-colour={turnColour}>
                <fieldset class="nt-turn min-w-0 shrink-0" disabled={session.busy}>
                    <Header />
                </fieldset>
                <div class="nt-below-masthead" {@attach openAtTheTop}>
                    <fieldset class="nt-turn min-w-0 shrink-0" disabled={session.busy}>
                        <div class="nt-turn-body">
                            {#if session.isViewingHistory}
                                <ActionPanel bind:ordersDrawerHeight />
                            {:else if session.attack || session.showsConcludedBattle}
                                <BattlePanel />
                                {#if session.gameState.result}
                                    <div class="nt-after-battle">
                                        <ActionPanel bind:ordersDrawerHeight />
                                    </div>
                                {/if}
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
                        class="nt-board-host"
                        style:--nt-board-covered="{boardCovered}px"
                        style:--nt-map-menu-top="{mapMenuTop}px"
                        bind:this={boardHost}
                    >
                        <ScalingWrapper
                            bind:this={wrapper}
                            justify="center"
                            controls="bottom-left"
                            expandable
                            maxScale={1.4}
                            renderAtViewScale
                            insetTop={boardCovered}
                            coverBelowScale={0.4}
                            onManualViewChange={() => (restoreView = undefined)}
                        >
                            <Board />
                            {#snippet overlay()}
                                <MapMenu
                                    onview={turnBoardTo}
                                    onsavepicture={savePicture}
                                    {savingPicture}
                                />
                            {/snippet}
                        </ScalingWrapper>
                    </div>
                </div>
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
        --nt-way-fill: rgba(236, 140, 52, 0.4);
        --nt-way-line: #a3521a;
        --nt-approach-fill: rgba(246, 222, 120, 0.55);
        --nt-closed-fill: rgba(43, 38, 32, 0.05);
        --nt-closed-line: rgba(43, 38, 32, 0.3);
        --nt-aimed-fill: rgba(43, 38, 32, 0.1);
        --nt-aimed-line: #2b2620;
    }

    .nt-table.nt-french-ways {
        --nt-way-fill: rgba(140, 104, 176, 0.38);
        --nt-way-line: #5c3f80;
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

    /* The masthead stays put; the panel and the map below it scroll together once the map, which keeps --nt-map-least clear of the orders sheet, no longer fits under the panel. */
    .nt-column {
        display: flex;
        flex: 1 1 0;
        flex-direction: column;
        min-height: 0;
    }

    .nt-below-masthead {
        display: flex;
        flex: 1 1 0;
        flex-direction: column;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: none;
    }

    .nt-board-host {
        --nt-map-least: 40dvh;
        flex: 1 1 0;
        min-height: calc(var(--nt-board-covered, 0px) + min(var(--nt-map-least), 100%));
        overflow: hidden;
    }

    @media (max-width: 639px) {
        .nt-board-host {
            --nt-map-least: 50dvh;
        }
    }

    .nt-turn {
        --nt-ground: #f9f6ee;
        background: var(--nt-ground);
        color: var(--nt-ink);
        /* Workaround: iOS takes two quick taps for a double-tap zoom, and adding units or stepping a loss is tapped quickly. */
        touch-action: manipulation;
    }

    .nt-after-battle {
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px solid color-mix(in srgb, var(--nt-ink) 25%, transparent);
    }

    .nt-turn-body {
        --nt-body-inline: 16px;
        padding: 0 var(--nt-body-inline) 11px;
    }

    @media (max-width: 639px) {
        .nt-turn-body {
            --nt-body-inline: 6px;
            padding: 0 var(--nt-body-inline) 6px;
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
