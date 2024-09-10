<script lang="ts">
    import { getContext } from 'svelte'
    import { isFish, isScoreHuts, isScoreIsland } from '@tabletop/kaivai'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { getHistoryDescriptionForAction } from '$lib/utils/historyDescriptions'
    import FishingResults from './FishingResults.svelte'
    import PlayerName from './PlayerName.svelte'
    import IslandScoringResults from './IslandScoringResults.svelte'
    import HutScoringResults from './HutScoringResults.svelte'

    let gameSession = getContext('gameSession') as KaivaiGameSession

    let lastAction = $derived.by(() => {
        if (gameSession.currentHistoryIndex >= 0) {
            return gameSession.actions[gameSession.currentHistoryIndex]
        }
        return undefined
    })
</script>

<div
    class="rounded-lg bg-transparent p-2 text-center flex flex-row flex-wrap justify-center items-center"
>
    <div class="flex flex-col justify-center items-center mx-8">
        <h1 class="text-xl uppercase text-[#372b0a] kaivai-font">
            {#if lastAction && lastAction.playerId}
                <PlayerName playerId={lastAction.playerId} />
            {/if}
            {getHistoryDescriptionForAction(lastAction)}
            {#if isFish(lastAction)}
                <FishingResults action={lastAction} />
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
