<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import UISundiver from './Sundiver.svelte'
    import { Sundiver, EffectType, StationType } from '@tabletop/sol'
    import EnergyNode from '$lib/images/energynode.svelte'
    import Foundry from '$lib/images/foundry.svelte'
    import Tower from '$lib/images/tower.svelte'
    import { range, type OffsetCoordinates } from '@tabletop/common'
    import Floater from '$lib/utils/Floater.svelte'
    import { getSpaceCentroid, offsetFromCenter } from '$lib/utils/boardGeometry.js'

    let {
        coords
    }: {
        coords?: OffsetCoordinates
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

    let regularSundivers: Sundiver[] = $derived.by(() => {
        const playerState = gameSession.myPlayerState
        if (!playerState) {
            return []
        }

        let movementPoints = playerState.movementPoints
        let catapultNextToGate =
            coords &&
            gameSession.gameState.activeEffect === EffectType.Catapult &&
            gameSession.gameState.board.isNextToGateAt(coords)

        if (gameSession.chosenMothership) {
            const holdDivers =
                playerState.holdSundiversPerPlayer().get(gameSession.myPlayer!.id) ?? []
            return holdDivers.slice(0, Math.min(movementPoints, holdDivers.length, 5))
        } else if (gameSession.chosenSource) {
            const sundivers = gameSession.gameState.board.sundiversForPlayerAt(
                playerState.playerId,
                gameSession.chosenSource
            )
            const regularDivers = sundivers.filter(
                (diver) =>
                    !gameSession.gameState.getEffectTracking().catapultedIds.includes(diver.id)
            )

            let numDivers = Math.min(regularDivers.length, 5)
            if (!catapultNextToGate) {
                numDivers = Math.min(movementPoints, numDivers)
            }
            return regularDivers.slice(0, numDivers)
        }

        return []
    })

    let catapultedDivers: Sundiver[] = $derived.by(() => {
        const playerState = gameSession.myPlayerState
        if (!playerState) {
            return []
        }
        const movementPoints = playerState.movementPoints

        if (gameSession.chosenSource) {
            const sundivers = gameSession.gameState.board.sundiversForPlayerAt(
                playerState.playerId,
                gameSession.chosenSource
            )
            const catapultedDivers = sundivers.filter((diver) =>
                gameSession.gameState.getEffectTracking().catapultedIds.includes(diver.id)
            )
            return catapultedDivers.slice(0, Math.min(movementPoints, catapultedDivers.length, 5))
        }

        return []
    })

    function selectAmount(amount: number, catapult: boolean = false) {
        console.log('MovementPicker selectAmount', amount, catapult)
        gameSession.catapultChoice = catapult
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
        class="flex flex-col justify-center items-center space-y-2 rounded-lg dark:bg-black/90 p-2 border-2 {borderColor}"
    >
        <div class="sol-font text-xs select-none text-[#ad9c80] tracking-widest">HOW MANY?</div>
        <div class="flex flex-row justify-center items-center gap-x-2">
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
            {#if regularSundivers.length > 0}
                <div class="flex flex-col justify-center items-center gap-y-2">
                    <div class="flex flex-row justify-center items-center gap-x-2">
                        {#each range(1, regularSundivers.length) as amount}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24px"
                                height="32px"
                                viewBox="0 0 24 32"
                            >
                                <UISundiver
                                    color={playerColor}
                                    width={24}
                                    height={32}
                                    fontSize={19}
                                    quantity={amount}
                                    offBoard={true}
                                    alwaysShowQuantity={true}
                                    onclick={() =>
                                        selectAmount(
                                            amount,
                                            gameSession.gameState.activeEffect ===
                                                EffectType.Catapult
                                        )}
                                />
                            </svg>
                        {/each}
                    </div>
                    {#if gameSession.gameState.activeEffect === EffectType.Catapult}
                        <div class="text-[.5rem] select-none text-[#ad9c80] tracking-widest">
                            REGULAR
                        </div>
                    {/if}
                </div>
            {/if}
            {#if catapultedDivers.length > 0 && regularSundivers.length > 0}
                <div class="flex flex-col justify-center items-center gap-y-2">
                    <div class="p-2 h-full text-[#ad9c80] tracking-widest">OR</div>
                    <div class="text-[.5rem]">&nbsp;</div>
                </div>
            {/if}
            {#if catapultedDivers.length > 0}
                <div class="flex flex-col justify-center items-center gap-y-2">
                    <div class="flex flex-row justify-center items-center gap-x-2">
                        {#each range(1, catapultedDivers.length) as amount}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24px"
                                height="32px"
                                viewBox="0 0 24 32"
                            >
                                <UISundiver
                                    color={playerColor}
                                    width={24}
                                    height={32}
                                    fontSize={19}
                                    quantity={amount}
                                    offBoard={true}
                                    alwaysShowQuantity={true}
                                    onclick={() => selectAmount(amount, false)}
                                />
                            </svg>
                        {/each}
                    </div>
                    <div class="text-[.5rem] select-none text-[#ad9c80] tracking-widest">
                        CATAPULTED
                    </div>
                </div>
            {/if}
        </div>
    </div>
</Floater>
