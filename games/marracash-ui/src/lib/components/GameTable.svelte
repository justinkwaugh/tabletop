<script lang="ts">
    import { untrack } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
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
    import PlayerAid from '$lib/components/PlayerAid.svelte'
    import { MarracashGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import CinzelBold from '$lib/fonts/Cinzel-Bold.woff2'
    import LibreBaskervilleBold from '$lib/fonts/LibreBaskerville-Bold.woff2'
    import LibreBaskervilleRegular from '$lib/fonts/LibreBaskerville-Regular.woff2'
    import LibreCaslonTextBold from '$lib/fonts/LibreCaslonText-Bold.woff2'

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

<CustomFont fontFamily="MarraCash Cinzel" url={CinzelBold} format="woff2" fontWeight="bold" />
<CustomFont
    fontFamily="Libre Caslon Text"
    url={LibreCaslonTextBold}
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
            <div class="relative grow-0 overflow-hidden" style="flex:1;">
                <!-- Below this fit the board's targets get too small to tap, so it opens zoomed in and pans -->
                <ScalingWrapper
                    justify="center"
                    controls={expanded ? 'bottom-left' : 'top-left'}
                    insetTop={expanded ? 0 : ZoomControlsHeight}
                    coverBelowScale={0.45}
                    expandable
                >
                    <div class="p-2">
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
        font-family: 'MarraCash Cinzel', Georgia, serif;
        font-weight: 700;
    }
</style>
