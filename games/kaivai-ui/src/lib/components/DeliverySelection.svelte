<script lang="ts">
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import fishtoken from '$lib/images/fishtoken.png'
    import { isDeliveryCell } from '@tabletop/kaivai'
    let gameSession = getContext('gameSession') as KaivaiGameSession

    let maxValue = $derived.by(() => {
        if (!gameSession.myPlayerState) {
            return 0
        }

        if (!gameSession.currentDeliveryLocation) {
            return 0
        }

        const cell = gameSession.gameState.board.getCellAt(gameSession.currentDeliveryLocation)
        if (!isDeliveryCell(cell)) {
            return 0
        }

        const scheduledDeliveries = gameSession.chosenDeliveries.reduce(
            (acc, delivery) => acc + delivery.amount,
            0
        )
        return Math.min(3 - cell.fish, gameSession.myPlayerState.numFish() - scheduledDeliveries)
    })

    function setDeliveryAmount(amount: number) {
        gameSession.setDelivery(amount)
    }
</script>

<div class="flex flex-row justify-center items-center space-x-2 p-2">
    {#if maxValue > 0}
        <button onclick={() => setDeliveryAmount(1)} class="relative fit-content">
            <img src={fishtoken} alt="fishtoken" class="w-[50px] h-[50px]" />
            <div
                class="rounded-full absolute top-0 left-0 w-full h-full flex justify-center items-center font-bold text-4xl text-white bg-black bg-opacity-10"
            >
                1
            </div>
        </button>
    {/if}
    {#if maxValue > 1}
        <button onclick={() => setDeliveryAmount(2)} class="relative fit-content">
            <img src={fishtoken} alt="fishtoken" class="w-[50px] h-[50px]" />
            <div
                class="rounded-full absolute top-0 left-0 w-full h-full flex justify-center items-center font-bold text-4xl text-white bg-black bg-opacity-10"
            >
                2
            </div>
        </button>
    {/if}
    {#if maxValue > 2}
        <button onclick={() => setDeliveryAmount(3)} class="relative fit-content">
            <img src={fishtoken} alt="fishtoken" class="w-[50px] h-[50px]" />
            <div
                class="rounded-full absolute top-0 left-0 w-full h-full flex justify-center items-center font-bold text-4xl text-white bg-black bg-opacity-10"
            >
                3
            </div>
        </button>
    {/if}
</div>
