<script lang="ts">
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import SolPicker from './SolPicker.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession() as SolGameSession
    let picker: SolPicker
    let choiceMade = false

    function choose(cluster: boolean) {
        picker.toggle()
        gameSession.teleportChoice = cluster
        choiceMade = true
    }

    function onClose() {}
</script>

<SolPicker bind:this={picker} {onClose}>
    <div class="text-center mb-2">TELEPORT?</div>
    <div class="flex flex-row justify-center items-center gap-x-2">
        <button class="px-2 py-1" onclick={() => choose(true)}>YES</button>
        <button class="px-2 py-1" onclick={() => choose(false)}>NO</button>
    </div>
</SolPicker>
