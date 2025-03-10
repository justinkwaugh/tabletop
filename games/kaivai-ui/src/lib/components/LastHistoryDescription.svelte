<script lang="ts">
    import { getContext } from 'svelte'
    import {
        ActionType,
        isCelebrate,
        isDeliver,
        isFish,
        isMove,
        isMoveGod,
        isPass,
        isScoreHuts,
        isScoreIsland,
        PassReason
    } from '@tabletop/kaivai'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { getHistoryDescriptionForAction } from '$lib/utils/historyDescriptions'
    import FishingResults from './FishingResults.svelte'
    import IslandScoringResults from './IslandScoringResults.svelte'
    import HutScoringResults from './HutScoringResults.svelte'
    import { GameSessionMode, PlayerName } from '@tabletop/frontend-components'
    import CelebrateResults from './CelebrateResults.svelte'
    import MoveGodResults from './MoveGodResults.svelte'

    let gameSession = getContext('gameSession') as KaivaiGameSession

    let lastAction = $derived.by(() => {
        let actionIndex = -1
        if (gameSession.mode === GameSessionMode.History && gameSession.currentHistoryIndex >= 0) {
            actionIndex = gameSession.currentHistoryIndex
        } else if (gameSession.mode === GameSessionMode.Play) {
            actionIndex = gameSession.actions.length - 1
        }
        if (actionIndex < 0) {
            return undefined
        }

        let action = gameSession.actions[actionIndex]
        if (isPass(action) && action.metadata?.reason !== PassReason.DoneActions) {
            action = gameSession.actions[actionIndex - 1]
        }
        if (action && action.type !== ActionType.PlaceScoringBid) {
            return action
        }
        return undefined
    })
</script>

{#if lastAction || gameSession.currentHistoryIndex == -1}
    <div
        class="rounded-lg bg-transparent p-2 text-center flex flex-row flex-wrap justify-center items-center"
    >
        <div class="flex flex-col justify-center items-center mx-8 uppercase kaivai-font">
            <h1 class="text-lg md:text-xl uppercase text-[#372b0a] kaivai-font leading-none">
                {#if lastAction && lastAction.playerId}
                    <PlayerName playerId={lastAction.playerId} />
                {/if}
                {getHistoryDescriptionForAction(
                    lastAction,
                    lastAction?.playerId === gameSession.myPlayer?.id
                )}{#if isMove(lastAction) && lastAction.metadata?.playerSunk}
                    sunk <PlayerName playerId={lastAction.metadata.playerSunk} possessive={true} /> boat
                    for a loss of {lastAction.metadata.gloryLost} glory
                {/if}{#if isDeliver(lastAction) && (lastAction.metadata?.numSold ?? 0) > 0}
                    , selling {lastAction.metadata?.numSold} fish for {lastAction.metadata
                        ?.earnings}
                {/if}
            </h1>
            {#if isFish(lastAction)}
                <FishingResults action={lastAction} justify={'center'} />
            {/if}
            {#if isScoreIsland(lastAction)}
                <IslandScoringResults action={lastAction} />
            {/if}
            {#if isScoreHuts(lastAction)}
                <HutScoringResults action={lastAction} justify={'center'} />
            {/if}
            {#if isCelebrate(lastAction)}
                <CelebrateResults action={lastAction} justify={'center'} />
            {/if}
            {#if isMoveGod(lastAction)}
                <MoveGodResults action={lastAction} justify={'center'} />
            {/if}
        </div>
    </div>
{/if}
