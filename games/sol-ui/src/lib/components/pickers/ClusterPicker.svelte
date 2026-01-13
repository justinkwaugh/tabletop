<script lang="ts">
import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import SolPicker from './SolPicker.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    let picker: SolPicker

    let gameSession = getGameSession() as SolGameSession
    let choiceMade = false

    function choose(cluster: boolean) {
        const playerId = gameSession.myPlayer?.id
        if (!playerId || gameSession.chosenSource === undefined) {
            return
        }
        picker.toggle()
        gameSession.clusterChoice = cluster
        if (cluster) {
            gameSession.chosenNumDivers = gameSession.gameState.board.sundiversForPlayerAt(
                playerId,
                gameSession.chosenSource
            ).length
        }
        choiceMade = true
    }

    function onClose() {
        if (choiceMade) {
            return
        }
        gameSession.back()
    }
</script>

<SolPicker bind:this={picker} {onClose}>
    <div class="text-center mb-2">CLUSTER?</div>
    <div class="flex flex-row justify-center items-center gap-x-2">
        <button class="px-2 py-1" onclick={() => choose(true)}>YES</button>
        <button class="px-2 py-1" onclick={() => choose(false)}>NO</button>
    </div>
</SolPicker>
