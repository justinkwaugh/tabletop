<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'

    let gameSession = getContext('gameSession') as SolGameSession
    let amount: number = $state(1)

    let maxAmount = $derived(gameSession.gameState.board.numMothershipLocations - 1)

    function increaseAmount() {
        if (amount < maxAmount) {
            amount += 1
        }
        for (const playerId of gameSession.gameState.players.map((p) => p.playerId)) {
            gameSession.gameState.advanceMothership(playerId)
        }
    }

    function decreaseAmount() {
        if (amount > 1) {
            amount -= 1
        }
    }

    function selectAmount() {
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
    <div class="text-4xl font-bold select-none cursor-default">{amount}</div>
    <button
        onclick={increaseAmount}
        class="tracking-none leading-none text-4xl py-1 px-2 select-none border-1 border-transparent rounded-full overflow-hidden"
        >+</button
    >
    <button onclick={() => selectAmount()}> OK </button>
</div>
