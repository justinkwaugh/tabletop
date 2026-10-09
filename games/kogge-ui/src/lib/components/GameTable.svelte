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
    import type { HydratedKoggeGameState, KoggeProjectedState } from '@tabletop/kogge'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import { KoggeGameSession } from '$lib/model/session.svelte'
    import { BoardStyle } from '$lib/board/geometry.js'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import FellRegular from '$lib/fonts/IMFellEnglish-Regular.woff2'
    import FellItalic from '$lib/fonts/IMFellEnglish-Italic.woff2'
    import FellSmallCaps from '$lib/fonts/IMFellEnglishSC-Regular.woff2'
    import BaskervilleRegular from '$lib/fonts/LibreBaskerville.woff2'
    import BaskervilleItalic from '$lib/fonts/LibreBaskerville-Italic.woff2'

    let {
        gameSession
    }: {
        gameSession: GameSession<KoggeProjectedState, HydratedKoggeGameState>
    } = $props()
    assert(gameSession instanceof KoggeGameSession, 'Kogge needs its own game session')
    setGameSession(gameSession)

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
        <ActionPanel />
    </div>
{/snippet}

<CustomFont fontFamily="IM Fell English" url={FellRegular} format="woff2" fontWeight="400" />
<CustomFont
    fontFamily="IM Fell English"
    url={FellItalic}
    format="woff2"
    fontWeight="400"
    fontStyle="italic"
/>
<CustomFont fontFamily="IM Fell English SC" url={FellSmallCaps} format="woff2" fontWeight="400" />
<CustomFont
    fontFamily="Libre Baskerville"
    url={BaskervilleRegular}
    format="woff2"
    fontWeight="400 700"
/>
<CustomFont
    fontFamily="Libre Baskerville"
    url={BaskervilleItalic}
    format="woff2"
    fontWeight="400 700"
    fontStyle="italic"
/>

<div class="kogge-table">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#3f2a16]"
                disabledColor="text-[#c4b08a]"
                borderClass="border-[#3f2a16] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-[#3f2a16]"
                    disabledColor="text-[#c4b08a]"
                    borderClass="rounded-lg border-2 border-[#3f2a16]"
                />
            </div>
            <DefaultTabs
                playersTitle="Merchants"
                activeTabClass="py-1 px-3 bg-[#3f2a16] border-2 border-transparent rounded-lg text-[#f4ead0]"
                inactiveTabClass="text-[#3f2a16] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#3f2a16]"
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
                    justify="center"
                    controls="bottom-left"
                    expandable
                    coverBelowScale={0.4}
                >
                    <Board />
                    {#snippet overlay()}
                        <div class="board-switch">
                            {#each [BoardStyle.Chart, BoardStyle.Redesign] as style (style)}
                                <button
                                    type="button"
                                    class:chosen={gameSession.boardStyle === style}
                                    onclick={() => (gameSession.boardStyle = style)}
                                    >{style === BoardStyle.Chart
                                        ? 'Drawn chart'
                                        : 'Redesign'}</button
                                >
                            {/each}
                        </div>
                    {/snippet}
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
    .kogge-table {
        background: #e7dcc0;
    }

    .action-area {
        margin: 0 0.5rem;
        border: 2px solid #3f2a16;
        border-radius: 8px;
        background: #f4ead0;
        box-shadow: 0 2px 5px rgba(42, 26, 12, 0.25);
    }

    .board-switch {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        border: 1.5px solid #3f2a16;
        border-radius: 6px;
        overflow: hidden;
        background: #f4ead0;
        font-size: 0.8rem;
    }

    .board-switch button {
        padding: 0.15rem 0.6rem;
        color: #3f2a16;
    }

    .board-switch button.chosen {
        background: #3f2a16;
        color: #f4ead0;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
        background: #e7dcc0;
    }
</style>
