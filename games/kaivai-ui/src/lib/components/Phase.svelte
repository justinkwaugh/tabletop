<script lang="ts">
    import { getContext } from 'svelte'
    import { Button } from 'flowbite-svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { PhaseName } from '@tabletop/kaivai'
    let gameSession = getContext('gameSession') as KaivaiGameSession
    const phase = $derived.by(() => {
        switch (gameSession.gameState.phases.currentPhase?.name) {
            case PhaseName.Bidding:
                return 'Bidding'

            case PhaseName.InitialHuts:
                return 'Placing Initial Huts'

            case PhaseName.MoveGod:
                return 'Moving the Fisherman God'

            case PhaseName.TakingActions:
                return 'Taking Actions'

            default:
                return ''
        }
    })

    const smallPhase = $derived.by(() => {
        switch (gameSession.gameState.phases.currentPhase?.name) {
            case PhaseName.Bidding:
                return 'Bidding'

            case PhaseName.InitialHuts:
                return 'Initial Huts'

            case PhaseName.MoveGod:
                return 'Moving the God'

            case PhaseName.TakingActions:
                return 'Taking Actions'

            default:
                return ''
        }
    })
    const round = $derived(gameSession.gameState.rounds.currentRound?.number)

    async function undo() {
        gameSession.resetAction()
        const response = await gameSession.undo()
    }
</script>

<div
    class="relative px-2 flex flex-row justify-between items-center w-full rounded-lg overflow-hidden bg-[#634a11] h-[42px]"
>
    <div class="flex flex-row justify-center items-center">
        <div>
            <span class="font-bold max-md:hidden uppercase text-3xl text-[#f5e397] text-nowrap"
                >Round {round}</span
            >
            <span class="font-bold md:hidden uppercase text-3xl text-[#f5e397] text-nowrap"
                >R{round}</span
            >
        </div>
        <div>
            <span
                class="max-md:hidden ms-4 uppercase text-2xl text-gray-200 text-nowrap kaivai-font"
                >{phase}</span
            >
            <span
                class="font-bold md:hidden ms-4 uppercase text-2xl text-gray-200 text-nowrap kaivai-font"
                >{smallPhase}</span
            >
        </div>
    </div>
    {#if gameSession.undoableAction}
        <button
            onclick={() => undo()}
            class="px-2 uppercase bg-transparent border-2 border-white rounded-lg text-white kaivai-font"
            >Undo</button
        >
    {/if}
</div>
