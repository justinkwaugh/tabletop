<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import Floater from '$lib/utils/Floater.svelte'

    let gameSession = getContext('gameSession') as SolGameSession
    let choiceMade = false

    function choose(cluster: boolean) {
        gameSession.teleportChoice = cluster
        choiceMade = true
    }

    function onClose() {
        if (choiceMade) {
            return
        }
    }
</script>

<Floater placement="top" reference={`#board-picker-ref`} offset={20} {onClose}>
    <div
        class="flex flex-col justify-center items-center space-y-2 rounded-lg dark:bg-black/90 p-2 sol-font text-xs text-[#ad9c80] tracking-widest"
    >
        <div class="text-center mb-2">Teleport?</div>
        <div class="flex flex-row justify-center items-center gap-x-2">
            <button class="px-4 py-2" onclick={() => choose(true)}>YES</button>
            <button class="px-4 py-2" onclick={() => choose(false)}>NO</button>
        </div>
    </div>
</Floater>
