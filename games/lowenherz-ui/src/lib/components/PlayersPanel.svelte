<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { flip } from 'svelte/animate'
    import { cubicOut } from 'svelte/easing'
    import PlayerState from '$lib/components/PlayerState.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()

    function rotatedToStart(playerIds: readonly string[], firstPlayerId: string): string[] {
        const start = playerIds.indexOf(firstPlayerId)
        if (start <= 0) return [...playerIds]
        return [...playerIds.slice(start), ...playerIds.slice(0, start)]
    }

    // turnOrder already starts at this round's first player (the turn manager rotates it).
    let playersAndStates = $derived.by(() => {
        const state = gameSession.gameState
        const seating = state.turnOrder
        const myPlayerId = gameSession.primaryGame.hotseat ? undefined : gameSession.myPlayer?.id
        const ordered = myPlayerId ? rotatedToStart(seating, myPlayerId) : seating
        return ordered.map((playerId) => {
            const player = gameSession.game.players.find((candidate) => candidate.id === playerId)
            assertExists(player, `No player for seat ${playerId}`)
            return { player, playerState: state.getPlayerState(playerId) }
        })
    })
</script>

<div class="rounded-lg space-y-2 text-center grow-0 shrink-0">
    {#each playersAndStates as playerAndState (playerAndState.player.id)}
        <div
            animate:flip={{
                duration: gameSession.restoredSilently ? 0 : 320,
                easing: cubicOut
            }}
        >
            <PlayerState player={playerAndState.player} playerState={playerAndState.playerState} />
        </div>
    {/each}
</div>
