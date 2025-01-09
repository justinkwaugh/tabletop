<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import Sundiver from './Sundiver.svelte'

    let gameSession = getContext('gameSession') as SolGameSession

    // Also need to incorporate how many available spaces are around the mothership
    let maxLaunches = $derived.by(() => {
        const movementPoints = gameSession.myPlayerState?.movementPoints ?? 0
        const numShipsInHold = gameSession.myPlayerState?.numSundiversInHold() ?? 0
        return Math.min(movementPoints, numShipsInHold)
    })

    function selectAmount(amount: number) {
        gameSession.chosenNumDivers = amount
    }
</script>

<div class="flex flex-row flex-wrap justify-center items-center gap-x-2">
    {#if maxLaunches > 0}
        <svg xmlns="http://www.w3.org/2000/svg" width="32px" height="42px" viewBox="0 0 32 42">
            <Sundiver
                color="green"
                quantity={1}
                location={{ x: -640 + 16, y: -640 + 21 }}
                onclick={() => selectAmount(1)}
            />
        </svg>
    {/if}
    {#if maxLaunches > 1}
        <svg xmlns="http://www.w3.org/2000/svg" width="32px" height="42px" viewBox="0 0 32 42">
            <Sundiver
                color="green"
                quantity={2}
                location={{ x: -640 + 16, y: -640 + 21 }}
                onclick={() => selectAmount(2)}
            />
        </svg>
    {/if}
    {#if maxLaunches > 2}
        <svg xmlns="http://www.w3.org/2000/svg" width="32px" height="42px" viewBox="0 0 32 42">
            <Sundiver
                color="green"
                quantity={3}
                location={{ x: -640 + 16, y: -640 + 21 }}
                onclick={() => selectAmount(3)}
            />
        </svg>
    {/if}
    {#if maxLaunches > 3}
        <svg xmlns="http://www.w3.org/2000/svg" width="32px" height="42px" viewBox="0 0 32 42">
            <Sundiver
                color="green"
                quantity={4}
                location={{ x: -640 + 16, y: -640 + 21 }}
                onclick={() => selectAmount(4)}
            />
        </svg>
    {/if}
    {#if maxLaunches > 4}
        <svg xmlns="http://www.w3.org/2000/svg" width="32px" height="42px" viewBox="0 0 32 42">
            <Sundiver
                color="green"
                quantity={5}
                location={{ x: -640 + 16, y: -640 + 21 }}
                onclick={() => selectAmount(5)}
            />
        </svg>
    {/if}
</div>
