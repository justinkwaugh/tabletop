<script lang="ts">
    import { untrack } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import {
        CustomFont,
        ScalingWrapper,
        DefaultTableLayout,
        DefaultTabs,
        GameChat,
        GameSession,
        HistoryControls
    } from '@tabletop/frontend-components'
    import type { HydratedMarracashGameState, MarracashProjectedState } from '@tabletop/marracash'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import PlayerAid from '$lib/components/PlayerAid.svelte'
    import { MarracashGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import LibreBaskervilleBold from '$lib/fonts/LibreBaskerville-Bold.woff2'
    import LibreBaskervilleRegular from '$lib/fonts/LibreBaskerville-Regular.woff2'
    import LibreCaslonTextBold from '$lib/fonts/LibreCaslonText-Bold.woff2'
    import ElMessiriLatin from '$lib/fonts/ElMessiri-Latin.woff2'
    import NotoNaskhArabicDirhamSign from '$lib/fonts/NotoNaskhArabic-DirhamSign.woff2'
    import { NightZelligeBackground } from '$lib/utils/tableBackground.js'
    import { PanelPalette } from '$lib/utils/playerPanel.js'

    let {
        gameSession
    }: { gameSession: GameSession<MarracashProjectedState, HydratedMarracashGameState> } = $props()

    function ensureMarracashGameSession(
        session: GameSession<MarracashProjectedState, HydratedMarracashGameState>
    ): MarracashGameSession {
        if (session instanceof MarracashGameSession) {
            return session
        }
        throw new Error('GameTable expected a MarracashGameSession')
    }

    const marracashSession = untrack(() => ensureMarracashGameSession(gameSession))
    setGameSession(marracashSession)

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

    // The zoom buttons sit over the board's top-left corner, where only mid-queue pawns are
    const ZoomControlsHeight = 52
</script>

<CustomFont
    fontFamily="Libre Caslon Text"
    url={LibreCaslonTextBold}
    format="woff2"
    fontWeight="bold"
/>
<CustomFont
    fontFamily="MarraCash El Messiri"
    url={ElMessiriLatin}
    format="woff2"
    fontWeight="bold"
/>
<CustomFont
    fontFamily="MarraCash Dirham Sign"
    url={NotoNaskhArabicDirhamSign}
    format="woff2"
    fontWeight="bold"
/>
<CustomFont fontFamily="MarraCash Baskerville" url={LibreBaskervilleRegular} format="woff2" />
<CustomFont
    fontFamily="MarraCash Baskerville"
    url={LibreBaskervilleBold}
    format="woff2"
    fontWeight="bold"
/>

{#snippet historyControls(shape: 'framed' | 'band')}
    <div class="history-controls {shape}">
        <HistoryControls
            borderClass=""
            bgClass="bg-transparent"
            enabledColor="history-control-on"
            disabledColor="history-control-off"
        />
    </div>
{/snippet}

<div
    class="marracash-text"
    style:background={NightZelligeBackground}
    style:--tile-deep={PanelPalette.tileDeep}
    style:--trim={PanelPalette.trim}
    style:--brass={PanelPalette.brass}
    style:--gold={PanelPalette.gold}
    style:--quiet={PanelPalette.quietCount}
    style:--night={PanelPalette.night}
>
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            {@render historyControls('band')}
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">{@render historyControls('framed')}</div>
            <DefaultTabs
                activeTabClass="marracash-tab marracash-tab-active"
                inactiveTabClass="marracash-tab marracash-tab-inactive"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat timeColor="text-[#ad9c80]" />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                <ActionPanel />
            </div>
            <div class="relative grow-0 overflow-hidden" style="flex:1;">
                <!-- Below this fit the board's targets get too small to tap, so it opens zoomed in and pans -->
                <div class="h-full w-full" inert={marracashSession.playerAidOpen && !expanded}>
                    <ScalingWrapper
                        justify="center"
                        controls={expanded ? 'bottom-left' : 'top-left'}
                        insetTop={expanded ? 0 : ZoomControlsHeight}
                        coverBelowScale={0.45}
                        expandable
                    >
                        <div class="p-2" inert={marracashSession.playerAidOpen}>
                            <Board />
                        </div>
                        {#snippet toolbar()}
                            <!-- Full screen is a modal dialog, so the action panel and the aid must come inside it. -->
                            <div {@attach watchExpansion}>
                                {#if expanded}
                                    <ActionPanel />
                                    {#if marracashSession.playerAidOpen}
                                        <PlayerAid />
                                    {/if}
                                {/if}
                            </div>
                        {/snippet}
                    </ScalingWrapper>
                </div>
                {#if marracashSession.playerAidOpen && !expanded}
                    <PlayerAid />
                {/if}
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .marracash-text {
        font-family: 'MarraCash Baskerville', Georgia, serif;
        font-variant-numeric: lining-nums;
    }

    .marracash-text :global(.marracash-display) {
        font-family: 'Libre Caslon Text', Georgia, serif;
        font-weight: 700;
        font-variant-numeric: lining-nums;
    }

    .marracash-text :global(.marracash-initial) {
        font-family: 'MarraCash El Messiri', Georgia, serif;
        font-weight: 700;
    }

    .marracash-text :global(.marracash-merchant) {
        font-family: 'MarraCash El Messiri', Georgia, serif;
        font-weight: 700;
        font-variant-numeric: lining-nums;
    }

    .history-controls {
        background: var(--night);
    }

    .history-controls.framed {
        border-radius: 8px;
        box-shadow: inset 0 0 0 2px var(--trim);
    }

    .history-controls.band {
        border-bottom: 2px solid var(--trim);
    }

    .marracash-text :global(.history-control-on) {
        color: var(--gold);
    }

    .marracash-text :global(.history-control-off) {
        color: color-mix(in srgb, var(--quiet) 45%, transparent);
    }

    .marracash-text :global(.marracash-tab) {
        padding: 0.25rem 0.75rem;
        border-radius: 8px;
        border: 2px solid var(--trim);
    }

    .marracash-text :global(.marracash-tab-active) {
        background: var(--brass);
        color: var(--tile-deep);
    }

    .marracash-text :global(.marracash-tab-inactive) {
        background: var(--night);
        color: var(--gold);
        border-color: color-mix(in srgb, var(--trim) 55%, transparent);
    }

    .marracash-text :global(.marracash-tab-inactive:hover) {
        border-color: var(--trim);
    }

    .marracash-text :global(.marracash-prompt) {
        font-family: 'MarraCash El Messiri', Georgia, serif;
        font-weight: 700;
        font-size: 17px;
        letter-spacing: 0.01em;
    }

    .marracash-text :global(.marracash-dirham-sign) {
        font-family: 'MarraCash Dirham Sign', serif;
        font-weight: 700;
    }
</style>
