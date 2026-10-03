<script lang="ts">
    import { untrack } from 'svelte'
    import {
        CustomFont,
        ScalingWrapper,
        DefaultSideContent,
        DefaultTableLayout,
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
</script>

<CustomFont fontFamily="Cinzel" url={CinzelBold} format="woff2" fontWeight="bold" />
<CustomFont
    fontFamily="Libre Caslon Text"
    url={LibreCaslonTextBold}
    format="woff2"
    fontWeight="bold"
/>
<CustomFont fontFamily="Libre Baskerville" url={LibreBaskervilleRegular} format="woff2" />
<CustomFont
    fontFamily="Libre Baskerville"
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
            </DefaultSideContent>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                <ActionPanel />
            </div>
            <div class="grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper justify="center" controls="bottom-left">
                    <div class="p-2 pb-14">
                        <Board />
                    </div>
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .marracash-text {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-variant-numeric: lining-nums;
    }

    .marracash-text :global(.marracash-display) {
        font-family: 'Libre Caslon Text', Georgia, serif;
        font-weight: 700;
        font-variant-numeric: lining-nums;
    }

    .marracash-text :global(.marracash-initial) {
        font-family: Cinzel, Georgia, serif;
        font-weight: 700;
    }
</style>
