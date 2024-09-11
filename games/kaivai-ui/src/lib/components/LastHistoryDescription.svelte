<script lang="ts">
    import { getContext } from 'svelte'
    import { ActionType, isFish, isScoreHuts, isScoreIsland } from '@tabletop/kaivai'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { getHistoryDescriptionForAction } from '$lib/utils/historyDescriptions'
    import FishingResults from './FishingResults.svelte'
    import PlayerName from './PlayerName.svelte'
    import IslandScoringResults from './IslandScoringResults.svelte'
    import HutScoringResults from './HutScoringResults.svelte'
    import { GameSessionMode } from '@tabletop/frontend-components'

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
        <div class="flex flex-col justify-center items-center mx-8">
            <h1 class="text-lg md:text-xl uppercase text-[#372b0a] kaivai-font leading-none">
                {#if lastAction && lastAction.playerId}
                    <PlayerName playerId={lastAction.playerId} />
                {/if}
                {getHistoryDescriptionForAction(
                    lastAction,
                    lastAction.playerId === gameSession.myPlayer?.id
                )}
                {#if isFish(lastAction)}
                    <FishingResults action={lastAction} justify={'center'} />
                {/if}
                {#if isScoreIsland(lastAction)}
                    <IslandScoringResults action={lastAction} />
                {/if}
                {#if isScoreHuts(lastAction)}
                    <HutScoringResults action={lastAction} />
                {/if}
            </h1>
        </div>
    </div>
{/if}
