<script lang="ts">
import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'
    import StallTile from '$lib/components/StallTile.svelte'
    import type { GoodsType } from '@tabletop/fresh-fish'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    let gameSession = getGameSession() as FreshFishGameSession

    function playerForFinalStall(goodsType: GoodsType) {
        const playersWithUnplacedStall = gameSession.gameState.players.filter((player) =>
            player.stalls.find((stall) => stall.goodsType === goodsType && !stall.placed)
        )

        return playersWithUnplacedStall.length === 1 ? playersWithUnplacedStall[0] : undefined
    }
</script>

<div class="flex flex-row justify-between items-end">
    <div class="text-center flex flex-row flex-wrap justify-start items-end">
        <div
            class="h-[70px] mb-2 flex flex-col justify-center items-center text-white p-2 rounded-lg bg-gray-700 mr-2"
        >
            <h1 class="text-md">Bag Tiles</h1>
            <h1 class="text-2xl">{gameSession.gameState.tileBag.remaining}</h1>
        </div>
        <div
            class="h-[70px] mb-2 flex flex-col justify-center items-center text-white py-2 px-4 border-gray-700 border rounded-lg"
        >
            <div class="flex flex-row justify-center items-center space-x-2">
                <h1 class="text-md mr-2">Final<br />Stalls</h1>

                {#each gameSession.gameState.finalStalls as stall (stall.goodsType)}
                    <StallTile
                        size={56}
                        playerId={playerForFinalStall(stall.goodsType)?.playerId}
                        goodsType={stall.goodsType}
                    />
                {/each}
            </div>
        </div>
    </div>
    <div class="mb-1">
        {#if gameSession.gameState.boardSeed !== undefined}
            <span class="text-xs mb-1 dark:text-gray-400"
                >Board - {gameSession.gameState.boardSeed}</span
            >
        {/if}
    </div>
</div>
