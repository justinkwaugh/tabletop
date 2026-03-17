<script lang="ts">
    import type { Player } from '@tabletop/common'
    import type { HydratedContainerPlayerState, ContainerPlayerState } from '@tabletop/container'
    import BoardBaseLayer from '$lib/components/BoardBaseLayer.svelte'
    import PlayerBoard from '$lib/components/PlayerBoard.svelte'
    import { BOARD_HEIGHT, BOARD_WIDTH, buildPlayerBoardSeats } from '$lib/definitions/boardLayout.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    type PlayerAndState = { player: Player; playerState: HydratedContainerPlayerState }

    const playersAndStates: PlayerAndState[] = $derived.by(() => {
        const playersAndStatesById = new Map(
            gameSession.gameState.players.map((playerState) => [
                playerState.playerId,
                {
                    player: getPlayerForState(playerState),
                    playerState
                }
            ])
        )

        return gameSession.gameState.turnManager.turnOrder
            .map((playerId) => playersAndStatesById.get(playerId))
            .filter((entry): entry is PlayerAndState => !!entry)
    })

    const playerBoardSeatById = $derived.by(() => {
        return new Map(
            buildPlayerBoardSeats(playersAndStates.map((entry) => entry.player.id)).map((seat) => [
                seat.playerId,
                seat
            ])
        )
    })

    function getPlayerForState(playerState: ContainerPlayerState) {
        return gameSession.game.players.find((player) => player.id === playerState.playerId)!
    }
</script>

<div class="board-shell">
    <div class="board-surface relative" style={`width:${BOARD_WIDTH}px;height:${BOARD_HEIGHT}px;`}>
        <svg
            class="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
            aria-label="Container board"
        >
            <BoardBaseLayer />
            {#each playersAndStates as playerAndState (playerAndState.player.id)}
                {@const seat = playerBoardSeatById.get(playerAndState.player.id)}
                {#if seat}
                    <PlayerBoard
                        player={playerAndState.player}
                        playerState={playerAndState.playerState}
                        orientation={seat.orientation}
                        x={seat.x}
                        y={seat.y}
                        width={seat.width}
                        height={seat.height}
                    />
                {/if}
            {/each}
        </svg>
    </div>
</div>

<style>
    .board-shell {
        position: relative;
        display: inline-flex;
        border-radius: 28px;
        background:
            radial-gradient(980px 680px at 50% 42%, rgba(141, 154, 217, 0.24), transparent 62%),
            #444a78;
    }

    .board-surface {
        overflow: hidden;
        border-radius: 24px;
        box-shadow:
            0 0 0 3px rgba(255, 255, 255, 0.08),
            0 18px 42px rgba(7, 12, 34, 0.34);
    }
</style>
