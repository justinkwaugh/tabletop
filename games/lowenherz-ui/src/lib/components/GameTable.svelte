<script lang="ts">
    import {
        ScalingWrapper,
        HistoryControls,
        DefaultTabs,
        DefaultTableLayout,
        CustomFont,
        GameSession
    } from '@tabletop/frontend-components'

    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import ActionToolbar from '$lib/components/ActionToolbar.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import TestingControls from '$lib/components/TestingControls.svelte'
    import PoliticsHand from '$lib/components/PoliticsHand.svelte'
    import PoliticsPileChooser from '$lib/components/PoliticsPileChooser.svelte'
    import SummaryStrip from '$lib/components/SummaryStrip.svelte'
    import StatusMessages from '$lib/components/StatusMessages.svelte'
    import parchmentTexture from '$lib/images/board/parchment-texture.jpg'

    import BlankenburgFont from '$lib/fonts/Blankenburg.woff2'
    import IMFellEnglishFont from '$lib/fonts/IMFellEnglish-Regular.woff2'
    import IMFellEnglishItalicFont from '$lib/fonts/IMFellEnglish-Italic.woff2'
    import UnifrakturMaguntiaFont from '$lib/fonts/UnifrakturMaguntia-Book.woff2'

    import type { LowenherzGameSession } from '$lib/model/session.svelte'
    import type { HydratedLowenherzGameState, LowenherzGameState } from '@tabletop/lowenherz'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

    let {
        gameSession
    }: { gameSession: GameSession<LowenherzGameState, HydratedLowenherzGameState> } = $props()
    setGameSession(gameSession as LowenherzGameSession)

    // Exposes the session for console debugging (Svelte context isn't reachable from
    // devtools otherwise) - e.g. `__gameSession.myRegions`.
    if (typeof window !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(window as any).__gameSession = gameSession
    }
</script>

<!-- The game's faces, declared the way every other game here declares them. Two of these
     families have two faces each, which is what the fontWeight/fontStyle props are for: without
     them both faces of a family land on the same family name with identical descriptors, the
     later rule wins, and the browser synthesises the italic and the bold from whichever face
     survived - shipping the real ones and then not using them. CustomFont supplies
     font-display: swap itself. -->
<CustomFont fontFamily="Blankenburg" url={BlankenburgFont} format="woff2" />
<CustomFont fontFamily="IM Fell English" url={IMFellEnglishFont} format="woff2" />
<CustomFont
    fontFamily="IM Fell English"
    url={IMFellEnglishItalicFont}
    format="woff2"
    fontStyle="italic"
/>
<CustomFont fontFamily="UnifrakturMaguntia" url={UnifrakturMaguntiaFont} format="woff2" />

<!-- Full Height and Width with 8px padding-->
<div
    style="--chat-height-offset: 0px; background-image: url({parchmentTexture}); background-repeat: repeat;"
>
    <DefaultTableLayout>
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    borderClass="border-b-2 border-black/20"
                    bgClass="bg-transparent"
                    enabledColor="text-black"
                    disabledColor="text-black/30"
                />
            </div>
            <SummaryStrip />
            <!-- The default active pill is bg-gray-300, which reads as a stray UI chip on
                 the parchment. bg-black/15 introduces no new hue at all - it just darkens
                 whatever the parchment already is, so the selected tab reads as a pressed
                 area of the same surface rather than a separate object sitting on it. -->
            <DefaultTabs
                activeTabClass="py-1 px-3 bg-black/15 border-2 border-black/25 rounded-lg text-black font-semibold"
                inactiveTabClass="text-black py-1 px-3 rounded-lg border-2 border-transparent hover:border-black/40"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                    <TestingControls />
                {/snippet}
                {#snippet history()}
                   <History />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <!--  Top part is not allowed to shrink -->
            <div class="shrink-0">
                {#if gameSession.gameState.result}
                    <GameEndPanel />
                {:else}
                    <!-- <InformationPanel /> -->
                {/if}
                <ActionToolbar />
                <!-- Below the toolbar so Undo stays at the very top, and outside ScalingWrapper
                     below so none of this text scales with the board. -->
                <StatusMessages />
                <!-- Also outside ScalingWrapper, and part of this shrink-0 column rather than a
                     floating overlay: it reserves real height here, pushing the board down (via
                     the ScalingWrapper below shrinking into whatever's left) while a pile is
                     being chosen/dealt from, instead of floating over whatever's on screen. -->
                <PoliticsPileChooser />
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

<!-- Rendered here (outside ScalingWrapper's transformed subtree) so its
     `position: fixed` is genuinely relative to the browser viewport, not scaled or
     clipped by the board's own responsive scaling. -->
<PoliticsHand />
