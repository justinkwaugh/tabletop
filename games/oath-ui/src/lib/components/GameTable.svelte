<script lang="ts">
    import { untrack } from 'svelte'
    import {
        ScalingWrapper,
        HistoryControls,
        DefaultTabs,
        DefaultTableLayout,
        GameChat,
        GameSession
    } from '@tabletop/frontend-components'

    import History from '$lib/components/History.svelte'
    import InformationPanel from '$lib/components/InformationPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import CardPreviewLayer from '$lib/components/CardPreviewLayer.svelte'
    import SeatDetailLayer from '$lib/components/SeatDetailLayer.svelte'
    import FitBox from '$lib/components/FitBox.svelte'
    import { MachineState } from '@tabletop/oath'

    import type { HydratedOathGameState, OathProjectedState } from '@tabletop/oath'
    import { setGameSession, toOathSession } from '$lib/model/sessionContext.svelte.js'

    let { gameSession }: { gameSession: GameSession<OathProjectedState, HydratedOathGameState> } =
        $props()
    let oath = $derived(toOathSession(gameSession))
    setGameSession(untrack(() => toOathSession(gameSession)))
</script>

<div class="oath-table">
    <DefaultTableLayout>
        <!-- The shared phone controls default to light icons; Oath's side panel is light. -->
        {#snippet mobileControlsContent()}
            <HistoryControls
                borderClass="border-b-2 border-stone-400"
                bgClass="bg-transparent"
                enabledColor="text-stone-800"
                disabledColor="text-stone-400"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    borderClass="border-b-2 border-stone-400"
                    bgClass="bg-transparent"
                    enabledColor="text-stone-800"
                    disabledColor="text-stone-400"
                />
            </div>
            <DefaultTabs
                activeTabClass="py-1 px-3 bg-gray-300 border-2 border-transparent rounded-lg text-black font-semibold"
                inactiveTabClass="text-black py-1 px-3 rounded-lg border-2 border-transparent hover:border-gray-700"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <!-- The shared chat defaults to light text; Oath's side panel is light. -->
                    <GameChat
                        messageTextColor="text-stone-800"
                        composerTextColor="text-stone-800"
                        timeColor="text-stone-500"
                        messageHoverColor="hover:bg-stone-200"
                        inputBgColor="bg-stone-100"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <!-- The panel is capped at a fraction of the column so the map keeps
                 its scale; `FitBox` scales a step that outgrows it (no page scroll). -->
            <FitBox fraction={0.4}>
                {#if gameSession.gameState.result}
                    <GameEndPanel />
                {:else}
                    <div
                        class="info-wrap"
                        class:info-wrap--redundant={oath.isMyTurn &&
                            oath.gameState.machineState === MachineState.ActPhase &&
                            !oath.selection.action}
                    >
                        <InformationPanel />
                    </div>
                    {#if !oath.isViewingHistory}
                        <ActionPanel />
                    {/if}
                {/if}
            </FitBox>
            <div class="grow-0 overflow-hidden min-h-0" style="flex:1;">
                <ScalingWrapper justify="center" controls="bottom-left">
                    <Board />
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
    <!-- Outside the table's scroll columns: a transformed ancestor (the board's
         `ScalingWrapper`, a scaled panel) would be the containing block for these
         fixed layers and scale or clip them with it. -->
    <SeatDetailLayer />
    <CardPreviewLayer />
</div>

<style>
    .info-wrap {
        display: contents;
    }
    /* On a phone held sideways the Act Phase header already says what the
       information line says; its height goes to the buttons. */
    @media (max-height: 520px) and (orientation: landscape) {
        .info-wrap--redundant {
            display: none;
        }
    }

    /* A held card must not raise the phone's image menu. */
    :global(.oath-table img) {
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
        -webkit-user-drag: none;
    }
</style>
