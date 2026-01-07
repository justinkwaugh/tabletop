<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import Sundiver from '$lib/components/Sundiver.svelte'
    import SolPicker from './SolPicker.svelte'

    let gameSession = getContext('gameSession') as SolGameSession
    let picker: SolPicker

    let players = $derived.by(() => {
        if (!gameSession.hatchLocation || !gameSession.myPlayer) {
            return []
        }

        const cell = gameSession.gameState.board.cellAt(gameSession.hatchLocation)
        const myPlayerId = gameSession.myPlayer.id

        const players = new Set<string>()
        for (const sundiver of cell.sundivers) {
            if (sundiver.playerId !== myPlayerId) {
                players.add(sundiver.playerId)
            }
        }

        return Array.from(players)
    })

    async function selectPlayer(playerId: string) {
        picker.toggle()
        gameSession.hatchTarget = playerId
        await gameSession.hatch()
    }

    function onClose() {
        if (gameSession.hatchTarget) {
            return
        }

        gameSession.hatchLocation = undefined
    }
</script>

<SolPicker bind:this={picker} {onClose}>
    <div class="text-center mb-2">WHICH?</div>
    <div class="flex flex-row flex-wrap justify-center items-center gap-x-2">
        {#each players as playerId (playerId)}
            <svg xmlns="http://www.w3.org/2000/svg" width="32px" height="42px" viewBox="0 0 32 42">
                <Sundiver
                    color={gameSession.colors.getPlayerColor(playerId)}
                    quantity={1}
                    location={{ x: -640 + 16, y: -640 + 21 }}
                    onclick={() => selectPlayer(playerId)}
                />
            </svg>
        {/each}
    </div>
</SolPicker>
