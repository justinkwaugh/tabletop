<script lang="ts">
    import { untrack } from 'svelte'
    import {
        CustomFont,
        ScalingWrapper,
        DefaultSideContent,
        DefaultTableLayout,
        GameChat,
        GameSession
    } from '@tabletop/frontend-components'
    import type { HydratedMarracashGameState, MarracashProjectedState } from '@tabletop/marracash'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import { MarracashGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import CinzelBold from '$lib/fonts/Cinzel-Bold.woff2'
    import LibreBaskervilleBold from '$lib/fonts/LibreBaskerville-Bold.woff2'
    import LibreBaskervilleRegular from '$lib/fonts/LibreBaskerville-Regular.woff2'
    import LibreCaslonTextBold from '$lib/fonts/LibreCaslonText-Bold.woff2'
    // PROTOTYPE: player card name and money face; ship a subset woff2 if it stays.
    import ElMessiriVariable from '$lib/fonts/ElMessiri-Variable.ttf'
    // PROTOTYPE: only the glyphs of the dirham sign د.م. (Google Fonts text= subset).
    import DirhamSignFont from '$lib/fonts/NotoNaskhArabic-DirhamSign.woff2'

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

    setGameSession(untrack(() => ensureMarracashGameSession(gameSession)))

    // The zoom buttons sit over the board's top-left corner, where only mid-queue pawns are
    const ZoomControlsHeight = 52
</script>

<CustomFont fontFamily="MarraCash Cinzel" url={CinzelBold} format="woff2" fontWeight="bold" />
<CustomFont
    fontFamily="Libre Caslon Text"
    url={LibreCaslonTextBold}
    format="woff2"
    fontWeight="bold"
/>
<CustomFont
    fontFamily="MarraCash El Messiri"
    url={ElMessiriVariable}
    format="truetype"
    fontWeight="400 700"
/>
<CustomFont
    fontFamily="MarraCash Dirham Sign"
    url={DirhamSignFont}
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

<div class="marracash-text">
    <DefaultTableLayout>
        {#snippet sideContent()}
            <DefaultSideContent>
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat timeColor="text-[#ad9c80]" />
                {/snippet}
            </DefaultSideContent>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                <ActionPanel />
            </div>
            <div class="grow-0 overflow-hidden" style="flex:1;">
                <!-- Below this fit the board's targets get too small to tap, so it opens zoomed in and pans -->
                <ScalingWrapper
                    justify="center"
                    controls="top-left"
                    insetTop={ZoomControlsHeight}
                    coverBelowScale={0.45}
                >
                    <div class="p-2">
                        <Board />
                    </div>
                </ScalingWrapper>
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
        font-family: 'MarraCash Cinzel', Georgia, serif;
        font-weight: 700;
    }
</style>
