<script lang="ts">
    import { getGameSession } from '$lib/model/gameSessionContext.js'
    import { Button, Select } from 'flowbite-svelte'

    let gameSession = getGameSession()

    async function undo() {
        gameSession.undo()
    }

    let activePlayerOptions = $derived.by(() => {
        return gameSession.activePlayers.map((player) => {
            return {
                name: player.name,
                value: player.id
            }
        })
    })

    async function setActivePlayer(event: Event) {
        const choice = (event.target as HTMLSelectElement).value
        const player = gameSession.activePlayers.find((player) => player.id === choice)
        if (player) {
            gameSession.chosenAdminPlayerId = player.id
        }
    }

    $effect(() => {
        if (gameSession.activePlayers.length === 1) {
            gameSession.chosenAdminPlayerId = gameSession.activePlayers[0].id
        }
    })
</script>

<div
    class="rounded-lg bg-transparent p-2 text-center flex flex-row flex-wrap justify-between items-center"
>
    <div class="flex gap-4 justify-center items-center">
        <h1 class="text-2xl text-[#372b0a] text-white leading-none">
            Acting as {gameSession.myPlayer?.name}
        </h1>
        {#if gameSession.activePlayers.length > 1}
            <Select
                class="bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded w-[200px]"
                onchange={(event: Event) => setActivePlayer(event)}
                size="sm"
                items={activePlayerOptions}
                value={gameSession.adminPlayerId}
            />
        {/if}
    </div>
    <Button
        onclick={() => undo()}
        size="xs"
        class="bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded"
    >
        Undo
    </Button>
</div>
