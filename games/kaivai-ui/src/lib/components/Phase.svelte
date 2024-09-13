<script lang="ts">
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { MachineState, PhaseName } from '@tabletop/kaivai'
    import { flip } from 'svelte/animate'
    let gameSession = getContext('gameSession') as KaivaiGameSession
    const phase = $derived.by(() => {
        switch (gameSession.gameState.phases.currentPhase?.name) {
            case PhaseName.Bidding:
                return 'Bidding'

            case PhaseName.InitialHuts:
                return 'Placing Initial Huts'

            case PhaseName.MoveGod:
                return 'Moving the God'

            case PhaseName.TakingActions:
                return 'Taking Actions'

            case PhaseName.FinalScoring:
                return 'Final Scoring'

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

            case PhaseName.FinalScoring:
                return 'Final Scoring'

            default:
                return ''
        }
    })
    const round = $derived(gameSession.gameState.rounds.currentRound?.number)

    async function undo() {
        gameSession.resetAction()
        const response = await gameSession.undo()
    }

    const playersByScore = $derived.by(() => {
        return gameSession.gameState.players.sort((a, b) => a.score - b.score)
    })
</script>

<div
    class="relative px-2 flex flex-row justify-between items-center w-full rounded-lg overflow-hidden bg-[#634a11] h-[42px]"
>
    <div class="flex flex-row justify-center items-center">
        <div>
            {#if gameSession.gameState.machineState === MachineState.EndOfGame}
                <span class="font-bold me-4 uppercase text-3xl text-[#f5e397] text-nowrap"
                    >Game Over</span
                >
            {:else if round !== undefined}
                <span
                    class="font-bold me-4 max-md:hidden uppercase text-3xl text-[#f5e397] text-nowrap"
                    >Round {round}</span
                >
                <span class="font-bold me-4 md:hidden uppercase text-3xl text-[#f5e397] text-nowrap"
                    >R{round}</span
                >
            {/if}
        </div>
        <div>
            <span class="max-md:hidden uppercase text-2xl text-gray-200 text-nowrap kaivai-font"
                >{phase}</span
            >
            <span
                class="font-bold md:hidden uppercase text-2xl text-gray-200 text-nowrap kaivai-font"
                >{smallPhase}</span
            >
        </div>
    </div>

    <div class="flex">
        <div class="flex flex-row justify-center items-center gap-1 max-lg:hidden">
            <h1 class="uppercase text-2xl text-[#f5e397] kaivai-font me-2">Glory</h1>
            {#each playersByScore as player (player.playerId)}
                <div
                    animate:flip={{ duration: 200 }}
                    class="px-2 flex flex-row justify-center items-center rounded-lg border border-gray-800 {gameSession.getPlayerTextColor(
                        player.playerId
                    )} {gameSession.getPlayerBgColor(player.playerId)}"
                >
                    <span class="uppercase text-2xl text-nowrap select-none kaivai-font"
                        >{player.score}</span
                    >
                </div>
            {/each}
        </div>

        {#if gameSession.undoableAction}
            <button
                onclick={() => undo()}
                class="ms-2 px-2 uppercase bg-transparent border-2 border-white rounded-lg text-white kaivai-font"
                >Undo</button
            >
        {/if}
    </div>
</div>
