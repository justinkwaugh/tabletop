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
    import type { HydratedHcgGameState, HcgGameState } from '@tabletop/hill-country-grocers'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import { MAP_RECT } from '$lib/utils/boardLayout.js'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import { HcgGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import LibreBaskervilleFont from '$lib/fonts/LibreBaskerville.woff2'
    import LibreBaskervilleItalicFont from '$lib/fonts/LibreBaskerville-Italic.woff2'

    let { gameSession }: { gameSession: GameSession<HcgGameState, HydratedHcgGameState> } =
        $props()
    assert(gameSession instanceof HcgGameSession, 'Hill Country Grocers needs its own session')
    setGameSession(gameSession)

    const MAP_MAX_SCALE = 2
    let wrapper = $state<ScalingWrapper>()

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
    <div class="action-area">
        {#if gameSession.gameState.result}
            <GameEndPanel />
        {:else}
            <ActionPanel />
        {/if}
    </div>
{/snippet}

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

<div class="bg-[#efe2c2]">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#7a1d22]"
                disabledColor="text-[#d4b48c]"
                borderClass="border-[#7a1d22] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-[#7a1d22]"
                    disabledColor="text-[#d4b48c]"
                    borderClass="rounded-lg border-2 border-[#7a1d22]"
                />
            </div>
            <DefaultTabs
                playersTitle="Investors"
                activeTabClass="py-1 px-3 bg-[#7a1d22] border-2 border-transparent rounded-lg text-[#fdf3dc]"
                inactiveTabClass="text-[#7a1d22] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#7a1d22]"
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
            <div class="shrink-0">
                {@render turnControls()}
            </div>
            <div class="grow-0 overflow-hidden pt-2" style="flex:1; min-height: 40dvh;">
                <ScalingWrapper
                    bind:this={wrapper}
                    justify="center"
                    controls="none"
                    maxScale={MAP_MAX_SCALE}
                    expandable
                >
                    <Board
                        onZoomToMap={() =>
                            wrapper?.focusRect(MAP_RECT, {
                                animate: true,
                                maxScale: MAP_MAX_SCALE,
                                padding: 8
                            })}
                        onShowBoard={() => wrapper?.fitToContent({ animate: true })}
                        onToggleFullScreen={() => wrapper?.toggleExpanded()}
                    />
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
    .action-area {
        margin: 0 8px;
        border: 2px solid #7a1d22;
        border-radius: 12px;
        background: #fdf8ec;
        box-shadow: 0 2px 6px rgba(40, 24, 8, 0.18);
    }

    .fullscreen-controls {
        padding-bottom: 8px;
        background: #efe2c2;
    }
</style>
