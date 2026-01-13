<script lang="ts">
    import {
        ScalingWrapper,
        HistoryControls,
        GameChat,
        DefaultTableLayout,
        DefaultTabs,
        CustomFont,
        GameSession
    } from '@tabletop/frontend-components'
    import Board from '$lib/components/Board.svelte'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'

    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import type { HydratedSolGameState, SolGameState } from '@tabletop/sol'
    import starsBg from '$lib/images/stars.jpg'
    import Momentum from './Momentum.svelte'
    import GameEndPanel from './GameEndPanel.svelte'
    import InformationPanel from './InformationPanel.svelte'
    import SolFont from '$lib/fonts/Metropolis-Bold.woff'
    import { setGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let {
        gameSession
    }: { gameSession: GameSession<SolGameState, HydratedSolGameState> } = $props()

    setGameSession(gameSession as SolGameSession)
</script>

<!-- This is a hack to allow for the game to provide its own font without
 needing to put it in the frontend's static dir -->
<CustomFont fontFamily="metropolis" url={SolFont} format="woff" />

<!-- Full Height and Width with 8px padding-->
<div class="bg-repeat" style="background-image: url('{starsBg}'); --chat-height-offset: 47px;">
    <DefaultTableLayout>
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    borderClass="border-b-1 border-[#ad9c80]"
                    enabledColor="text-[#ad9c80]"
                    disabledColor="text-[#373128]"
                />
            </div>
            <Momentum />
            <DefaultTabs
                playersTitle="ARKS"
                fontClass="gap-1 sol-font uppercase font-size-sm tracking-widest"
                activeTabClass="py-1 px-1 border-1 border-transparent rounded-lg text-gray-200 text-md"
                inactiveTabClass="py-1 px-1 text-[#ad9c80] rounded-lg border-1 border-transparent hover:border-[#ad9c80] text-md"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-[#ad9c80]"
                        bgColor="bg-black"
                        inputBgColor="bg-black"
                        inputBorderColor="border-[#ad9c80]"
                        borderColor="border-[#ad9c80]"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <!--  Top part is not allowed to shrink -->
            <div class="shrink-0">
                {#if gameSession.gameState.result}
                    <GameEndPanel />
                {:else}
                    <InformationPanel />
                {/if}
            </div>
            <!--  Bottom part fills the remaining space, but hides overflow to keep it's height fixed.
              This allows the wrapper to scale to its bounds regardless of its content size-->
            <div class="grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper justify="center" controls="bottom-left">
                    <Board />
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style global>
    :global(.sol-font) {
        font-family: 'metropolis', ui-sans-serif, system-ui, sans-serif;
    }

    :global(.sol-font-bold) {
        font-family: 'metropolis', ui-sans-serif, system-ui, sans-serif;
        font-weight: bold;
        letter-spacing: 0.2em;
    }

    :global(.sol.green .a) {
        color: #88c188;
        fill: #88c188;
    }

    :global(.sol.green .b) {
        color: #6db16d;
        fill: #6db16d;
    }

    :global(.sol.green .c) {
        color: #389638;
        fill: #389638;
    }

    :global(.sol.green .d) {
        color: #116511;
        fill: #116511;
    }

    :global(.sol.blue .a) {
        color: #0e97c6;
        fill: #0e97c6;
    }

    :global(.sol.blue .b) {
        color: #0e9cca;
        fill: #0e9cca;
    }

    :global(.sol.blue .c) {
        color: #0c7ea4;
        fill: #0c7ea4;
    }

    :global(.sol.blue .d) {
        color: #12404c;
        fill: #12404c;
    }

    :global(.sol.purple .a) {
        color: #b58ad0;
        fill: #b58ad0;
    }

    :global(.sol.purple .b) {
        color: #ad7fcb;
        fill: #ad7fcb;
    }

    :global(.sol.purple .c) {
        color: #9f6dc2;
        fill: #9f6dc2;
    }

    :global(.sol.purple .d) {
        color: #773fa9;
        fill: #773fa9;
    }

    :global(.sol.gray .a) {
        color: #d2d4d7;
        fill: #d2d4d7;
    }

    :global(.sol.gray .b) {
        color: #ccced2;
        fill: #ccced2;
    }

    :global(.sol.gray .c) {
        color: #bbbbbb;
        fill: #bbbbbb;
    }

    :global(.sol.gray .d) {
        color: #777777;
        fill: #777777;
    }

    :global(.sol.black .a) {
        color: #888888;
        fill: #888888;
    }

    :global(.sol.black .b) {
        color: #666666;
        fill: #666666;
    }

    :global(.sol.black .c) {
        color: #444444;
        fill: #444444;
    }

    :global(.sol.black .d) {
        color: #222222;
        fill: #222222;
    }
</style>
