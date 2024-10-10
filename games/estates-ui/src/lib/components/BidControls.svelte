<script lang="ts">
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession

    function incrementBid() {
        if (gameSession.currentBid < gameSession.validBid) {
            gameSession.currentBid = gameSession.validBid
        }
        gameSession.currentBid = Math.min(
            gameSession.currentBid + 1,
            gameSession.myPlayerState?.money ?? 0
        )
    }

    function decrementBid() {
        gameSession.currentBid = Math.max(
            gameSession.currentBid - 1,
            (gameSession.gameState.auction?.highBid ?? 0) + 1
        )
    }
</script>

<div
    class="flex flex-col justify-center items-center rounded-lg p-2 fit-content text-gray-200 select-none w-[120px]"
>
    <div class="flex flex-row justify-center items-center text-lg text-nowrap">Your Bid</div>
    <div class="flex flex-row justify-center items-center text-center text-gray-200 gap-x-2">
        <button
            class="flex flex-col justify-center items-center rounded-full w-[30px] h-[30px] border border-gray-700 bg-gray-900"
            onclick={decrementBid}><h1 class="text-2xl leading-none pb-1">-</h1></button
        >
        <h1 class="text-4xl leading-none">{gameSession.validBid}</h1>
        <button
            class="flex flex-col justify-center items-center rounded-full w-[30px] h-[30px] border border-gray-700 bg-gray-900"
            onclick={incrementBid}><h1 class="text-2xl leading-none pb-1">+</h1></button
        >
    </div>
</div>
