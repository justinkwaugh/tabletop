<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import Sundiver from './Sundiver.svelte'
    import { EffectType, StationType } from '@tabletop/sol'
    import EnergyNode from '$lib/images/energynode.svelte'
    import Foundry from '$lib/images/foundry.svelte'
    import Tower from '$lib/images/tower.svelte'
    import { range, type OffsetCoordinates } from '@tabletop/common'
    import Floater from '$lib/utils/Floater.svelte'
    import { getSpaceCentroid, offsetFromCenter } from '$lib/utils/boardGeometry.js'

    let {
        coords
    }: {
        coords: OffsetCoordinates
    } = $props()

    let gameSession = getContext('gameSession') as SolGameSession
    let playerColor = $derived(gameSession.colors.getPlayerColor(gameSession.myPlayer?.id))
    let borderColor = $derived(gameSession.colors.getBorderColor(playerColor))
    let station = $derived.by(() => {
        if (
            !gameSession.myPlayer ||
            !gameSession.chosenSource ||
            gameSession.gameState.activeEffect !== EffectType.Juggernaut
        ) {
            return
        }
        if (
            !gameSession.gameState.board.hasStationAt(
                gameSession.chosenSource,
                gameSession.myPlayer.id
            )
        ) {
            return
        }
        return gameSession.gameState.board.cellAt(gameSession.chosenSource).station
    })

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

    function selectStation() {
        if (station) {
            gameSession.juggernautStationId = station.id
        }
    }

    function onClose() {
        console.log('MovementPicker onClose')
        gameSession.back()
    }
</script>

<Floater placement="top" reference={`#movement-picker-ref`} offset={20} {onClose}>
    <div
        class="flex flex-row flex-wrap justify-center items-center gap-x-2 rounded-lg dark:bg-black/90 p-2 border-2 {borderColor}"
    >
        {#if station}
            <button onclick={selectStation}>
                {#if station.type === StationType.EnergyNode}
                    <EnergyNode
                        width={46}
                        height={48}
                        color={gameSession.colors.getPlayerColor(gameSession.myPlayer?.id)}
                    />
                {:else if station.type === StationType.SundiverFoundry}
                    <Foundry
                        width={46}
                        height={48}
                        color={gameSession.colors.getPlayerColor(gameSession.myPlayer?.id)}
                    />
                {:else if station.type === StationType.TransmitTower}
                    <Tower
                        width={40}
                        height={80}
                        color={gameSession.colors.getPlayerColor(gameSession.myPlayer?.id)}
                    />
                {/if}
            </button>
        {/if}
        {#if maxPieces > 0}
            <div class="flex flex-col justify-center items-center gap-y-2">
                <div class="sol-font text-xs select-none text-[#ad9c80] tracking-widest">
                    HOW MANY?
                </div>
                <div class="flex flex-row justify-center items-center gap-x-2">
                    {#each range(1, maxPieces) as amount}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24px"
                            height="32px"
                            viewBox="0 0 24 32"
                        >
                            <Sundiver
                                color={playerColor}
                                width={24}
                                height={32}
                                fontSize={19}
                                quantity={amount}
                                offBoard={true}
                                alwaysShowQuantity={true}
                                onclick={() => selectAmount(amount)}
                            />
                        </svg>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
</Floater>
