<script lang="ts">
    import { getContext } from 'svelte'
    import type { BridgesGameSession } from '$lib/model/BridgesGameSession.svelte'
    import { MachineState } from '@tabletop/bridges-of-shangri-la'
    import { PlayerName } from '@tabletop/frontend-components'

    let gameSession = getContext('gameSession') as BridgesGameSession

    const currentPlayerId = $derived(
        gameSession.gameState.activePlayerIds.length === 1
            ? gameSession.gameState.activePlayerIds[0]
            : undefined
    )

    const waitingText = $derived.by(() => {
        if (gameSession.gameState.machineState === MachineState.RecruitingStudents) {
            return 'to recruit a second student...'
        }

        return 'to take their turn...'
    })
</script>

<div
    class="mb-2 rounded-lg bg-gray-300 p-2 text-center flex flex-row flex-wrap justify-center items-center"
>
    <div class="flex flex-col justify-center items-center mx-4">
        <h1 class="text-lg">
            Waiting for <PlayerName playerId={currentPlayerId} />
            {waitingText}
        </h1>
    </div>
</div>
