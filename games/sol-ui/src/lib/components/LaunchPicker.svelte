<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import Sundiver from './Sundiver.svelte'

    let gameSession = getContext('gameSession') as SolGameSession
    let playerColor = $derived(gameSession.colors.getPlayerColor(gameSession.myPlayer?.id))

    // Also need to incorporate how many available spaces are around the mothership
    let maxPieces = $derived.by(() => {
        const playerState = gameSession.myPlayerState
        if (!playerState) {
            return 0
        }
        const movementPoints = playerState.movementPoints

        if (gameSession.chosenMothership) {
            const numShipsInHold = playerState.numSundiversInHold() ?? 0
            return Math.min(movementPoints, numShipsInHold)
        } else if (gameSession.chosenSource) {
            const sundivers = gameSession.gameState.board.sundiversForPlayerAt(
                playerState.playerId,
                gameSession.chosenSource
            )
            return Math.min(movementPoints, sundivers.length)
        }

        return 0
    })

    function selectAmount(amount: number) {
        gameSession.chosenNumDivers = amount
    }
</script>

<div class="flex flex-row flex-wrap justify-center items-center gap-x-2">
    {#if maxPieces > 0}
        <svg xmlns="http://www.w3.org/2000/svg" width="32px" height="42px" viewBox="0 0 32 42">
            <Sundiver
                color={playerColor}
                quantity={1}
                location={{ x: -640 + 16, y: -640 + 21 }}
                onclick={() => selectAmount(1)}
            />
        </svg>
    {/if}
    {#if maxPieces > 1}
        <svg xmlns="http://www.w3.org/2000/svg" width="32px" height="42px" viewBox="0 0 32 42">
            <Sundiver
                color={playerColor}
                quantity={2}
                location={{ x: -640 + 16, y: -640 + 21 }}
                onclick={() => selectAmount(2)}
            />
        </svg>
    {/if}
    {#if maxPieces > 2}
        <svg xmlns="http://www.w3.org/2000/svg" width="32px" height="42px" viewBox="0 0 32 42">
            <Sundiver
                color={playerColor}
                quantity={3}
                location={{ x: -640 + 16, y: -640 + 21 }}
                onclick={() => selectAmount(3)}
            />
        </svg>
    {/if}
    {#if maxPieces > 3}
        <svg xmlns="http://www.w3.org/2000/svg" width="32px" height="42px" viewBox="0 0 32 42">
            <Sundiver
                color={playerColor}
                quantity={4}
                location={{ x: -640 + 16, y: -640 + 21 }}
                onclick={() => selectAmount(4)}
            />
        </svg>
    {/if}
    {#if maxPieces > 4}
        <svg xmlns="http://www.w3.org/2000/svg" width="32px" height="42px" viewBox="0 0 32 42">
            <Sundiver
                color={playerColor}
                quantity={5}
                location={{ x: -640 + 16, y: -640 + 21 }}
                onclick={() => selectAmount(5)}
            />
        </svg>
    {/if}
</div>
