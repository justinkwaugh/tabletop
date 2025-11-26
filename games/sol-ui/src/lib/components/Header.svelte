<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import MoveArrows from '$lib/images/movearrows.svelte'
    import ConvertAtom from '$lib/images/convertatom.svelte'
    import ActivateBolt from '$lib/images/activatebolt.svelte'
    import { ActionCategory } from '$lib/definition/actionCategory.js'

    let gameSession = getContext('gameSession') as SolGameSession

    function back() {
        gameSession.back()
    }

    async function undo() {
        await gameSession.undo()
    }

    let moveChosen = $derived(gameSession.chosenActionCategory === ActionCategory.Move)
    let convertChosen = $derived(gameSession.chosenActionCategory === ActionCategory.Convert)
    let activateChosen = $derived(gameSession.chosenActionCategory === ActionCategory.Activate)
</script>

{#if gameSession.chosenActionCategory}
    <div
        class="flex flex-row justify-between items-center pb-1 px-4 text-xl tracking-[.15em] h-[42px] border-b border-[#ad9c80]"
    >
        {#if moveChosen || gameSession.isMoving}
            <div class="inline-flex items-center gap-x-2">
                <MoveArrows />
                <div>MOVING</div>
            </div>

            <div>
                MOVEMENT REMAINING: {gameSession.myPlayerState?.movementPoints}
            </div>
        {:else if convertChosen}
            <div class="inline-flex items-center gap-x-2">
                <ConvertAtom />
                <div>CONVERTING</div>
            </div>
        {:else if activateChosen}
            <div class="inline-flex items-center gap-x-2">
                <ActivateBolt />
                <div>ACTIVATING</div>
            </div>
        {/if}
        <div>
            {#if gameSession.midAction}
                <button
                    onclick={back}
                    class="w-fit box-border flex items-center justify-center text-lg bg-transparent rounded-lg"
                >
                    UNDO
                </button>
            {:else if gameSession.undoableAction}
                <button
                    onclick={undo}
                    class="w-fit box-border flex items-center justify-center text-lg bg-transparent rounded-lg"
                >
                    UNDO
                </button>
            {/if}
        </div>
    </div>
{/if}
