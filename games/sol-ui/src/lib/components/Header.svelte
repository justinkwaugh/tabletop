<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import MoveArrows from '$lib/images/movearrows.svelte'
    import ConvertAtom from '$lib/images/convertatom.svelte'
    import ActivateBolt from '$lib/images/activatebolt.svelte'
    import { ActionCategory } from '$lib/definition/actionCategory.js'
    import CardBack from '$lib/images/cardBack2.png'
    import { Suit } from '@tabletop/sol'
    import Card from './Card.svelte'
    import { fade } from 'svelte/transition'

    let gameSession = getContext('gameSession') as SolGameSession

    let cardBackImage = `url(${CardBack})`
    function back() {
        gameSession.back()
    }

    async function undo() {
        await gameSession.undo()
    }

    let currentSolarFlare = $derived(
        (gameSession.gameState.solarFlares ?? 0) -
            (gameSession.gameState.solarFlaresRemaining ?? 0) +
            1
    )
</script>

<div
    class="flex flex-row justify-between items-center pb-1 px-4 text-xl tracking-[.15em] h-[44px] border-b border-[#ad9c80]"
>
    <div class="header-grid grid">
        {#key gameSession.gameState.machineState}
            {#if gameSession.isMoving}
                <div
                    in:fade={{ duration: 300, delay: 100 }}
                    out:fade={{ duration: 100 }}
                    class="inline-flex items-center gap-x-2"
                >
                    <MoveArrows />
                    <div>MOVING</div>
                </div>
            {:else if gameSession.isConverting}
                <div
                    in:fade={{ duration: 300, delay: 100 }}
                    out:fade={{ duration: 100 }}
                    class="inline-flex items-center gap-x-2"
                >
                    <ConvertAtom />
                    <div>CONVERTING</div>
                </div>
            {:else if gameSession.isActivating}
                <div
                    in:fade={{ duration: 300, delay: 100 }}
                    out:fade={{ duration: 100 }}
                    class="inline-flex items-center gap-x-2"
                >
                    <ActivateBolt />
                    <div>ACTIVATING</div>
                </div>
            {:else if gameSession.isDrawingCards || gameSession.isChoosingCard}
                <div
                    in:fade={{ duration: 300, delay: 100 }}
                    out:fade={{ duration: 100 }}
                    class="inline-flex items-center gap-x-2"
                >
                    <div
                        class="rounded-sm dark:bg-gray-700 h-[36px] w-[26px] overflow-hidden border-1 border-[#5a5141]"
                    >
                        <div
                            style="background-image: {cardBackImage}"
                            class="bg-center bg-cover w-full h-full"
                        ></div>
                    </div>
                    <div>INSTABILITY CARDS</div>
                </div>
            {:else if gameSession.isSolarFlares}
                <div
                    in:fade={{ duration: 300, delay: 100 }}
                    out:fade={{ duration: 100 }}
                    class="inline-flex items-center gap-x-2"
                >
                    <div class="rounded-sm dark:bg-gray-700 h-[36px] w-[22px] overflow-hidden">
                        <Card card={{ id: 'header-flare', suit: Suit.Flare }} />
                    </div>
                    <div>
                        SOLAR FLARE {currentSolarFlare} OF {gameSession.gameState.solarFlares}
                    </div>
                </div>
            {:else}
                <div
                    in:fade={{ duration: 300, delay: 100 }}
                    out:fade={{ duration: 100 }}
                    class="inline-flex items-center gap-x-2"
                >
                    <div>TURN START</div>
                </div>
            {/if}
        {/key}
    </div>
    {#if gameSession.isMoving}
        <div>
            REMAINING: {gameSession.myPlayerState?.movementPoints}
        </div>
    {/if}
    <div>
        <div class="header-grid grid">
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
</div>

<style>
    .header-grid > * {
        grid-area: 1 / 1;
    }
</style>
