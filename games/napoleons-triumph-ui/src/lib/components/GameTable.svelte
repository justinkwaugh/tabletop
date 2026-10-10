<script lang="ts">
    import {
        ScalingWrapper,
        DefaultTableLayout,
        CustomFont,
        GameSession,
        GameChat,
        HistoryControls,
        DefaultTabs
    } from '@tabletop/frontend-components'
    import { assert } from '@tabletop/common'
    import { onMount, untrack } from 'svelte'
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
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import OrderSheet from '$lib/components/OrderSheet.svelte'
    import { LOCALE_GEOMETRY } from '$lib/map/boardGeometry.js'
    import { BoardView, boundsOf, nextView, viewFor } from '$lib/utils/boardView.js'
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
    let orderStripHeight = $state(0)
    let restoreView: ReturnType<ScalingWrapper['captureView']> | undefined

    const VIEW_NAMES: Record<BoardView, string> = {
        [BoardView.North]: 'North up',
        [BoardView.French]: 'From the French lines',
        [BoardView.Allied]: 'From the Allied lines'
    }

    // The armies sit along the long sides of the board (rule 4 map), so a wide screen opens turned to the viewer's side.
    onMount(() => {
        if (window.innerWidth > window.innerHeight) {
            session.boardView = viewFor(session.mySide)
        }
    })

    const BATTLE_FOCUS = { maxScale: 1.15, padding: 36 }
    const SELECTION_FOCUS_BELOW_ZOOM = 0.3
    const SELECTION_FOCUS = { maxScale: 0.62, padding: 24 }

    function outlines(locales: number[]) {
        return locales.flatMap((locale) => LOCALE_GEOMETRY[locale]?.outline ?? [])
    }

    const battleKey = $derived(`${session.battleLocales.join(':')}|${session.boardRotation}`)

    $effect(() => {
        void battleKey
        untrack(() => {
            if (!wrapper) return
            const locales = session.battleLocales
            if (locales.length === 0) {
                restoreView?.({ animate: true })
                restoreView = undefined
                return
            }
            restoreView ??= wrapper.captureView()
            wrapper.focusRect(boundsOf(outlines(locales), session.boardRotation), {
                animate: true,
                ...BATTLE_FOCUS
            })
        })
    })

    $effect(() => {
        const group = session.selectedGroup
        untrack(() => {
            if (!wrapper || !group || session.zoom >= SELECTION_FOCUS_BELOW_ZOOM) return
            const locales = [
                ...(group.position ? [group.position.locale] : []),
                ...session.targets.map((target) => target.position.locale)
            ]
            const points = outlines(locales)
            if (points.length === 0) return
            wrapper.focusRect(boundsOf(points, session.boardRotation), {
                animate: true,
                ...SELECTION_FOCUS
            })
        })
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

<div class="nt-table bg-[#e9e6dc]">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#2b2620]"
                disabledColor="text-[#b9b3a4]"
                borderClass="border-[#2b2620] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-[#2b2620]"
                    disabledColor="text-[#b9b3a4]"
                    borderClass="rounded-lg border-2 border-[#2b2620]"
                />
            </div>
            <DefaultTabs
                playersTitle="Armies"
                activeTabClass="py-1 px-3 bg-[#2b2620] border-2 border-transparent rounded-lg text-[#f1ecdc]"
                inactiveTabClass="text-[#2b2620] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#2b2620]"
            >
                {#snippet playersPanel()}
                    <ArmiesPanel />
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
            <fieldset class="min-w-0 shrink-0" disabled={session.busy}>
                <Header />
                {#if session.isViewingHistory}
                    <ActionPanel />
                {:else if session.attack}
                    <BattlePanel />
                {:else if session.isAuction}
                    <AuctionPanel />
                {:else if session.isDeploying}
                    <SetupPanel />
                {:else}
                    <ActionPanel />
                {/if}
            </fieldset>
            <div class="grow-0 overflow-hidden" style="flex:1; min-height: 40dvh;">
                <ScalingWrapper
                    bind:this={wrapper}
                    justify="center"
                    controls="bottom-left"
                    expandable
                    maxScale={1.4}
                    insetTop={orderStripHeight}
                    coverBelowScale={0.4}
                    onManualViewChange={() => (restoreView = undefined)}
                >
                    <Board />
                    {#snippet overlay()}
                        <div
                            class="absolute inset-x-0 top-0 z-10"
                            bind:clientHeight={orderStripHeight}
                        >
                            <OrderSheet />
                        </div>
                        <button
                            type="button"
                            class="nt-view-button pointer-events-auto absolute bottom-1 right-1 z-10"
                            aria-label="Turn the map"
                            onclick={() => (session.boardView = nextView(session.boardView))}
                            >{VIEW_NAMES[session.boardView]}</button
                        >
                    {/snippet}
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .nt-table {
        font-family: 'Libre Baskerville', Georgia, serif;
    }

    .nt-view-button {
        border: 1px solid #2b2620;
        border-radius: 4px;
        padding: 0.1rem 0.5rem;
        font-size: 12px;
        color: #2b2620;
        background: #e9e6dc;
    }

    .nt-table :global(.nt-plain-button) {
        border: 1px solid #2b2620;
        border-radius: 4px;
        padding: 0.15rem 0.6rem;
        color: #2b2620;
        background: transparent;
    }

    .nt-table :global(.nt-plain-button:hover:not(:disabled):not([aria-pressed='true'])) {
        background: rgba(43, 38, 32, 0.08);
    }

    .nt-table :global(.nt-plain-button[aria-pressed='true']) {
        background: #2b2620;
        color: #f1ecdc;
    }
</style>
