<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import {
        CustomFont,
        ScalingWrapper,
        DefaultTableLayout,
        GameSession,
        GameChat,
        HistoryControls,
        DefaultTabs
    } from '@tabletop/frontend-components'

    import Board from '$lib/components/Board.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import History from '$lib/components/History.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import Header from '$lib/components/Header.svelte'
    import BuildingStyleToggle from '$lib/components/BuildingStyleToggle.svelte'
    import CinzelLatin from '$lib/fonts/Cinzel-Latin.woff2'
    import EBGaramondLatin from '$lib/fonts/EBGaramond-Latin.woff2'
    import EBGaramondItalicLatin from '$lib/fonts/EBGaramond-Italic-Latin.woff2'
    import { MaplePlank, SlateBackground, TablePalette } from '$lib/theme.js'

    import type { UrbinoGameSession } from '$lib/model/session.svelte'
    import type { HydratedUrbinoGameState, UrbinoGameState } from '@tabletop/urbino'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

    let { gameSession }: { gameSession: GameSession<UrbinoGameState, HydratedUrbinoGameState> } =
        $props()
    setGameSession(gameSession as UrbinoGameSession)

    const TOGGLE_ROOM = 48

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

<CustomFont fontFamily="Urbino Cinzel" url={CinzelLatin} format="woff2" fontWeight="400 900" />
<CustomFont fontFamily="Urbino Garamond" url={EBGaramondLatin} format="woff2" fontWeight="400 800" />
<CustomFont
    fontFamily="Urbino Garamond"
    url={EBGaramondItalicLatin}
    format="woff2"
    fontWeight="400 800"
    fontStyle="italic"
/>

{#snippet actionArea()}
    <Header />
    {#if gameSession.gameState.result}
        <GameEndPanel />
    {:else}
        <ActionPanel />
    {/if}
{/snippet}

<div
    class="urbino-table"
    style:background={SlateBackground}
    style:--slate-panel={TablePalette.slatePanel}
    style:--slate-edge={TablePalette.slateEdge}
    style:--cream={TablePalette.cream}
    style:--cream-quiet={TablePalette.creamQuiet}
    style:--maple={TablePalette.maple}
    style:--maple-light={TablePalette.mapleLight}
    style:--maple-deep={TablePalette.mapleDeep}
    style:--maple-edge={TablePalette.mapleEdge}
    style:--ink={TablePalette.ink}
    style:--ink-quiet={TablePalette.inkQuiet}
    style:--gold={TablePalette.gold}
    style:--gold-deep={TablePalette.goldDeep}
    style:--maple-plank={MaplePlank}
>
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-(--cream)"
                disabledColor="text-(--slate-edge)"
                borderClass="border-(--slate-edge) border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-(--cream)"
                    disabledColor="text-(--slate-edge)"
                    borderClass="rounded-lg border-2 border-(--slate-edge)"
                    bgClass="bg-(--slate-panel)"
                />
            </div>
            <DefaultTabs
                activeTabClass="urbino-tab urbino-tab-active"
                inactiveTabClass="urbino-tab urbino-tab-inactive"
                fontClass="urbino-display"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-(--cream-quiet)"
                        bgColor="bg-(--slate-panel)"
                        messageTextColor="text-(--cream)"
                        composerTextColor="text-(--cream)"
                        inputBgColor="bg-(--slate-panel)"
                        inputBorderColor="border-(--slate-edge)"
                        borderColor="border-(--slate-edge)"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                {@render actionArea()}
            </div>
            <div class="grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper
                    justify="center"
                    controls="bottom-left"
                    insetTop={TOGGLE_ROOM}
                    expandable
                >
                    <div class="flex flex-col items-center gap-1 px-2 pt-1 pb-2">
                        <Board />
                        <p class="urbino-display text-[20px] tracking-[0.18em] text-(--cream-quiet)">
                            Urbino · Dieter Stein
                        </p>
                    </div>
                    {#snippet overlay()}
                        <div class="pointer-events-auto absolute top-2 right-3 z-10">
                            <BuildingStyleToggle />
                        </div>
                    {/snippet}
                    {#snippet toolbar()}
                        <!-- Full screen is a modal dialog, so the action area must come inside it to keep playing. -->
                        <div {@attach watchExpansion}>
                            {#if expanded}
                                {@render actionArea()}
                            {/if}
                        </div>
                    {/snippet}
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .urbino-table {
        font-family: 'Urbino Garamond', Georgia, serif;
        font-size: 16px;
        color: var(--cream);
    }

    .urbino-table :global(.urbino-display) {
        font-family: 'Urbino Cinzel', Georgia, serif;
        font-weight: 700;
    }

    .urbino-table :global(.urbino-plank) {
        background: var(--maple-plank);
        color: var(--ink);
    }

    .urbino-table :global(.urbino-tab) {
        padding: 3px 9px;
        border-radius: 8px;
        border: 2px solid transparent;
        letter-spacing: 0.03em;
        font-size: 13px;
    }

    .urbino-table :global(.urbino-tab-active) {
        background: var(--maple-plank);
        color: var(--ink);
        border-color: var(--maple-edge);
        box-shadow: 0 2px 6px rgb(0 0 0 / 0.3);
    }

    .urbino-table :global(.urbino-tab-inactive) {
        color: var(--cream);
    }

    .urbino-table :global(.urbino-tab-inactive:hover) {
        border-color: var(--slate-edge);
    }
</style>
