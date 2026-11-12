<script lang="ts">
    import { untrack } from 'svelte'
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
    import type { HydratedOstbahnGameState, OstbahnGameState } from '@tabletop/preussische-ostbahn'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import FocusToggle from '$lib/components/FocusToggle.svelte'
    import { BoardFocus, RAILROADS_FOCUS_RECT } from '$lib/utils/boardGeometry.js'
    import { OstbahnGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import LibreBaskervilleFont from '$lib/fonts/LibreBaskerville.woff2'
    import LibreBaskervilleItalicFont from '$lib/fonts/LibreBaskerville-Italic.woff2'
    import AlegreyaBoldFont from '$lib/fonts/Alegreya-Bold.woff2'

    let { gameSession }: { gameSession: GameSession<OstbahnGameState, HydratedOstbahnGameState> } =
        $props()
    setGameSession(
        untrack(() => {
            assert(
                gameSession instanceof OstbahnGameSession,
                'Preußische Ostbahn needs its own session'
            )
            return gameSession
        })
    )

    const FOCUS_INSET = 34
    let wrapper = $state<ScalingWrapper>()
    let focus = $state<BoardFocus | undefined>(BoardFocus.Map)

    function chooseFocus(next: BoardFocus) {
        if (!wrapper) return
        focus = next
        if (next === BoardFocus.Map) {
            wrapper.fitToContent({ animate: true })
        } else {
            wrapper.focusRect(RAILROADS_FOCUS_RECT, { animate: true, maxScale: 2, padding: 8 })
        }
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

{#snippet actionArea()}
    <div class="action-area">
        {#if gameSession.gameState.result && !gameSession.isViewingHistory}
            <GameEndPanel />
        {:else}
            <ActionPanel />
        {/if}
    </div>
{/snippet}

<CustomFont
    fontFamily="Ostbahn Baskerville"
    url={LibreBaskervilleFont}
    format="woff2"
    fontWeight="400 700"
/>
<CustomFont
    fontFamily="Ostbahn Baskerville"
    url={LibreBaskervilleItalicFont}
    format="woff2"
    fontWeight="400 700"
    fontStyle="italic"
/>
<CustomFont fontFamily="Ostbahn Alegreya" url={AlegreyaBoldFont} format="woff2" fontWeight="700" />

<div class="bg-[#1b2b44]">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#efe6cc]"
                disabledColor="text-[#6f86a8]"
                borderClass="border-[#efe6cc] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-[#efe6cc]"
                    disabledColor="text-[#6f86a8]"
                    borderClass="rounded-lg border-2 border-[#efe6cc]"
                />
            </div>
            <DefaultTabs
                playersTitle="Investors"
                activeTabClass="py-1 px-3 bg-[#efe6cc] border-2 border-transparent rounded-lg text-[#1b2b44]"
                inactiveTabClass="text-[#efe6cc] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#efe6cc]"
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
            <div class="table-column">
                <div class="shrink-0">
                    <Header />
                    {@render actionArea()}
                </div>
                <div class="grow-0 overflow-hidden pt-2" style="flex:1; min-height: 40dvh;">
                    <ScalingWrapper
                        bind:this={wrapper}
                        justify="center"
                        controls="bottom-left"
                        maxScale={2}
                        coverBelowScale={0.45}
                        renderAtViewScale
                        expandable
                        insetTop={FOCUS_INSET}
                        onManualViewChange={() => (focus = undefined)}
                    >
                        <Board />
                        {#snippet overlay()}
                            <FocusToggle selected={focus} onselect={chooseFocus} />
                        {/snippet}
                        {#snippet toolbar()}
                            <!-- Full screen is a modal dialog, so the turn controls must come inside it. -->
                            <div {@attach watchExpansion}>
                                {#if expanded}
                                    <div class="fullscreen-controls">
                                        <Header />
                                        {@render actionArea()}
                                    </div>
                                {/if}
                            </div>
                        {/snippet}
                    </ScalingWrapper>
                </div>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .action-area {
        margin: 0 8px;
        border: 2px solid #0f1a2c;
        border-radius: 12px;
        background: var(--po-card);
        box-shadow: 0 2px 6px rgba(40, 24, 8, 0.18);
    }

    .table-column {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
        background: var(--po-table);
    }
</style>
