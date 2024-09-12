<script lang="ts">
    import { getContext } from 'svelte'
    import {
        ActionType,
        isCelebrate,
        isFish,
        isMove,
        isMoveGod,
        isScoreHuts,
        isScoreIsland
    } from '@tabletop/kaivai'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { getHistoryDescriptionForAction } from '$lib/utils/historyDescriptions'
    import FishingResults from './FishingResults.svelte'
    import PlayerName from './PlayerName.svelte'
    import IslandScoringResults from './IslandScoringResults.svelte'
    import HutScoringResults from './HutScoringResults.svelte'
    import { GameSessionMode } from '@tabletop/frontend-components'
    import CelebrateResults from './CelebrateResults.svelte'
    import MoveGodResults from './MoveGodResults.svelte'

    let gameSession = getContext('gameSession') as KaivaiGameSession

    let lastAction = $derived.by(() => {
        let action
        if (gameSession.mode === GameSessionMode.History && gameSession.currentHistoryIndex >= 0) {
            action = gameSession.actions[gameSession.currentHistoryIndex]
        } else if (gameSession.mode === GameSessionMode.Play) {
            action = gameSession.actions[gameSession.actions.length - 1]
        }
        if (action && action.type !== ActionType.PlaceScoringBid) {
            return action
        }
        return undefined
    })
</script>

{#if lastAction}
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
                    lastAction.playerId === gameSession.myPlayer?.id
                )}
                {#if isMove(lastAction) && lastAction.metadata?.playerSunk}
                    sunk <PlayerName playerId={lastAction.metadata.playerSunk} possessive={true} /> boat
                    for a loss of {lastAction.metadata.gloryLost} glory
                {/if}
            </h1>
            {#if isFish(lastAction)}
                <FishingResults action={lastAction} justify={'center'} />
            {/if}
            {#if isScoreIsland(lastAction)}
                <IslandScoringResults action={lastAction} />
            {/if}
            {#if isScoreHuts(lastAction)}
                <HutScoringResults action={lastAction} />
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
