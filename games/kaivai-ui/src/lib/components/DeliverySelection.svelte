<script lang="ts">
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import fishtoken from '$lib/images/fishtoken.png'
    import { isDeliveryCell } from '@tabletop/kaivai'
    import { sameCoordinates } from '@tabletop/common'
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

    let hasDelivery = $derived.by(() => {
        if (!gameSession.myPlayerState) {
            return false
        }

        if (!gameSession.currentDeliveryLocation) {
            return false
        }

        return (
            gameSession.chosenDeliveries.find((delivery) =>
                sameCoordinates(delivery.coords, gameSession.currentDeliveryLocation)
            ) !== undefined
        )
    })

    function setDeliveryAmount(amount: number) {
        gameSession.setDelivery(amount)
    }
</script>

{#snippet token(amount: number)}
    <button onclick={() => setDeliveryAmount(amount)} class="relative fit-content">
        <img src={fishtoken} alt="fishtoken" class="w-[50px] h-[50px]" />
        <div
            class="rounded-full absolute top-0 left-0 w-full h-full flex justify-center items-center font-bold text-4xl text-white bg-black/10 kaivai-font text-shadow"
        >
            {amount}
        </div>
    </button>
{/snippet}

<div class="flex flex-row justify-center items-center space-x-2 p-2">
    {#if hasDelivery}
        {@render token(0)}
    {/if}
    {#if maxValue > 0}
        {@render token(1)}
    {/if}
    {#if maxValue > 1}
        {@render token(2)}
    {/if}
    {#if maxValue > 2}
        {@render token(3)}
    {/if}
</div>
