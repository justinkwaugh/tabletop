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
    import { PointedArchMask } from '$lib/utils/doorwayTab.js'

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
    style:--parchment={PanelPalette.parchment}
    style:--cream={PanelPalette.cream}
    style:--door-mask={PointedArchMask}
    style:--door-wood={PanelPalette.doorWood}
    style:--door-grain={PanelPalette.doorGrain}
    style:--door-shadow={PanelPalette.doorShadow}
    style:--door-ink={PanelPalette.doorInk}
    style:--lamp-glow={PanelPalette.lampGlow}
    style:--lamp={PanelPalette.lamp}
    style:--lamp-edge={PanelPalette.lampEdge}
    style:--threshold-shadow={PanelPalette.thresholdShadow}
>
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            {@render historyControls('band')}
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">{@render historyControls('framed')}</div>
            <DefaultTabs
                fontClass="marracash-merchant"
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
                    <GameChat
                        bgColor="bg-(--night)"
                        borderColor="border-(--trim)"
                        timeColor="text-(--quiet)"
                        messageTextColor="text-(--parchment)"
                        composerTextColor="text-(--parchment)"
                        messageHoverColor="hover:bg-(--tile-deep)"
                        inputBgColor="bg-(--tile-deep)"
                        inputBorderColor="border-(--trim)"
                    />
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
                        controls="bottom-left"
                        coverBelowScale={0.45}
                        maxScale={1.5}
                        maxFitScale={1.5}
                        renderAtViewScale
                        expandable
                    >
                        <div class="px-2 pt-3 pb-11" inert={marracashSession.playerAidOpen}>
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

    .marracash-text :global([role='tablist']:has(.marracash-tab)) {
        gap: 6px;
        margin: 0;
        padding: 0 6px;
        border-bottom: 3px solid var(--trim);
        box-shadow: 0 3px 0 -1px var(--threshold-shadow);
    }

    .marracash-text :global([role='tablist']:has(.marracash-tab) > li) {
        display: flex;
        flex: 1;
        margin: 0;
    }

    .marracash-text :global(.marracash-tab) {
        flex: 1;
        height: 38px;
        padding: 13px 6px 3px;
        font-size: 15px;
        letter-spacing: 0.04em;
        isolation: isolate;
    }

    .marracash-text :global(.marracash-tab > div) {
        justify-content: center;
    }

    .marracash-text :global(.marracash-tab::before),
    .marracash-text :global(.marracash-tab::after) {
        content: '';
        position: absolute;
        z-index: -1;
        mask: var(--door-mask);
    }

    .marracash-text :global(.marracash-tab::before) {
        inset: 0;
        background: var(--trim);
    }

    .marracash-text :global(.marracash-tab::after) {
        inset: 2.5px 2.5px 0;
    }

    .marracash-text :global(.marracash-tab:focus-visible) {
        outline: 2px solid var(--gold);
        outline-offset: 2px;
    }

    .marracash-text :global(.marracash-tab-active) {
        color: var(--door-ink);
    }

    .marracash-text :global(.marracash-tab-active::after) {
        background: radial-gradient(
            ellipse 85% 100% at 50% 100%,
            var(--lamp-glow) 0%,
            var(--lamp) 55%,
            var(--lamp-edge) 100%
        );
    }

    .marracash-text :global(.marracash-tab-inactive) {
        color: var(--gold);
    }

    .marracash-text :global(.marracash-tab-inactive::after) {
        background: repeating-linear-gradient(
            90deg,
            var(--door-wood) 0 9px,
            var(--door-grain) 9px 10px
        );
    }

    .marracash-text :global(.marracash-tab-inactive:hover) {
        filter: brightness(1.2);
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
