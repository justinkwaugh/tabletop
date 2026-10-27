<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
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
    import type { HydratedPowerGridGameState, PowerGridProjectedState } from '@tabletop/power-grid'
    import { PowerGridGameSession } from '$lib/model/session.svelte.js'
    import { setGameSession } from '$lib/model/sessionContext.svelte.js'
    import { mapArt } from '$lib/maps/boardArt.js'
    import { stackedAreaRect } from '$lib/utils/boardLayout.js'
    import Board from './Board.svelte'
    import Header from './Header.svelte'
    import ActionArea from './ActionArea.svelte'
    import PlayersPanel from './players/PlayersPanel.svelte'
    import History from './history/History.svelte'
    import StencilFont from '$lib/fonts/BigShouldersStencilDisplay.woff2'
    import BarlowMedium from '$lib/fonts/BarlowCondensed-Medium.woff2'
    import BarlowSemiBold from '$lib/fonts/BarlowCondensed-SemiBold.woff2'
    import BarlowBold from '$lib/fonts/BarlowCondensed-Bold.woff2'

    let {
        gameSession
    }: {
        gameSession: GameSession<PowerGridProjectedState, HydratedPowerGridGameState>
    } = $props()
    assert(gameSession instanceof PowerGridGameSession, 'Power Grid needs its own game session')
    setGameSession(gameSession)

    let narrow = $state(false)
    const watchWidth: Attachment<HTMLElement> = () => {
        const query = window.matchMedia('(max-width: 639px)')
        const read = () => {
            narrow = query.matches
        }
        read()
        query.addEventListener('change', read)
        return () => query.removeEventListener('change', read)
    }

    // On a phone the stacked board is taller than the screen, so bring the area of the
    // player's decision into view when it changes.
    let wrapper: ReturnType<typeof ScalingWrapper> | undefined = $state()
    const art = $derived(mapArt(gameSession.gameState.mapId))
    $effect(() => {
        const area = gameSession.decisionArea
        if (narrow && area && area !== 'map' && wrapper) {
            wrapper.focusRect(stackedAreaRect(art, area), { padding: 8, animate: true })
        }
    })

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

{#snippet turnControls()}
    <Header />
    <ActionArea />
{/snippet}

<CustomFont
    fontFamily="Big Shoulders Stencil Display"
    url={StencilFont}
    format="woff2"
    fontWeight="100 900"
/>
<CustomFont fontFamily="Barlow Condensed" url={BarlowMedium} format="woff2" fontWeight="500" />
<CustomFont fontFamily="Barlow Condensed" url={BarlowSemiBold} format="woff2" fontWeight="600" />
<CustomFont fontFamily="Barlow Condensed" url={BarlowBold} format="woff2" fontWeight="700" />

<div class="pg-table" {@attach watchWidth}>
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#ecebe1]"
                disabledColor="text-[#6d7562]"
                borderClass="border-[#56643f] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-[#ecebe1]"
                    disabledColor="text-[#6d7562]"
                    borderClass="rounded-lg border-2 border-[#56643f]"
                />
            </div>
            <DefaultTabs
                playersTitle="Companies"
                activeTabClass="py-1 px-3 bg-[#56643f] border-2 border-transparent rounded-lg text-[#ecebe1]"
                inactiveTabClass="text-[#cfd4bd] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#56643f]"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-gray-400"
                        bgColor="bg-[#1b201b]"
                        inputBgColor="bg-[#1b201b]"
                        inputBorderColor="border-gray-500"
                        borderColor="border-gray-500"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                {@render turnControls()}
            </div>
            <div class="grow-0 overflow-hidden pt-3" style="flex:1; min-height: 40dvh;">
                <ScalingWrapper
                    bind:this={wrapper}
                    justify="center"
                    controls="bottom-left"
                    expandable
                    coverBelowScale={0.45}
                >
                    <Board stacked={narrow} />
                    {#snippet toolbar()}
                        <!-- Full screen is a modal dialog, so the turn controls must come inside it. -->
                        <div {@attach watchExpansion}>
                            {#if expanded}
                                <div class="fullscreen-controls">
                                    {@render turnControls()}
                                </div>
                            {/if}
                        </div>
                    {/snippet}
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .pg-table {
        width: 100%;
        background: #262d27;
        color: #ecebe1;
        font-family: 'Barlow Condensed', sans-serif;
    }
    .fullscreen-controls {
        padding-bottom: 8px;
        background: #262d27;
    }
</style>
