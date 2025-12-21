<script lang="ts">
    import { getContext, onMount } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'

    let gameSession = getContext('gameSession') as SolGameSession
    let amount: number = $state(0)

    let maxAmount = $derived(gameSession.gameState.board.numMothershipLocations - 1)

    function increaseAmount() {
        if (amount < maxAmount) {
            amount += 1
            for (const key of gameSession.mothershipLocations.keys()) {
                const currentValue = gameSession.mothershipLocations.get(key) ?? 0
                const newValue = currentValue - 1
                gameSession.mothershipLocations.set(key, currentValue - 1)
            }
        }
    }

    function decreaseAmount() {
        if (amount > 1) {
            amount -= 1
            for (const key of gameSession.mothershipLocations.keys()) {
                const currentValue = gameSession.mothershipLocations.get(key) ?? 0
                gameSession.mothershipLocations.set(key, currentValue + 1)
            }
        }
    }

    function selectAmount() {
        if (amount === 0) {
            return
        }
        gameSession.accelerationAmount = amount
        gameSession.accelerate()
    }
</script>

<div class="flex flex-row flex-wrap justify-center items-center gap-x-2 mb-2">
    <button
        onclick={decreaseAmount}
        class="tracking-none leading-none text-4xl py-1 px-2 select-none rounded-full border-1 border-transparent overflow-hidden"
        >-</button
    >
    <button onclick={() => selectAmount()}> ACCEPT </button>
    <button
        onclick={increaseAmount}
        class="tracking-none leading-none text-4xl py-1 px-2 select-none border-1 border-transparent rounded-full overflow-hidden"
        >+</button
    >
</div>
