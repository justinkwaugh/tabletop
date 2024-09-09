<script lang="ts">
    import { getContext } from 'svelte'
    import { ActionType, HutType, MachineState } from '@tabletop/kaivai'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { get } from 'svelte/store'
    import { getHistoryDescriptionForAction } from '$lib/utils/historyDescriptions'

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
                <span
                    class="rounded px-2 {gameSession.getPlayerBgColor(
                        lastAction.playerId
                    )} {gameSession.getPlayerTextColor(lastAction.playerId)}"
                    >{gameSession.getPlayerName(lastAction.playerId)}</span
                >
            {/if}
            {getHistoryDescriptionForAction(lastAction)}
        </h1>
    </div>
</div>
