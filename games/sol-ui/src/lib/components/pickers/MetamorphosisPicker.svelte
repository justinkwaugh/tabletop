<script lang="ts">
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { StationType } from '@tabletop/sol'
    import Tower from '$lib/images/tower.svelte'
    import Foundry from '$lib/images/foundry.svelte'
    import EnergyNode from '$lib/images/energynode.svelte'
    import SolPicker from './SolPicker.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession() as SolGameSession
    let picker: SolPicker
    let choiceMade = $state(false)

    let station = $derived.by(() => {
        const playerState = gameSession.myPlayerState
        if (!playerState) {
            return null
        }
        return gameSession.gameState.getActivatingStation(playerState.playerId)
    })

    let stationTypes = $derived.by(() => {
        const playerState = gameSession.myPlayerState
        if (!station || !playerState) {
            return []
        }

        const types = [
            StationType.EnergyNode,
            StationType.SundiverFoundry,
            StationType.TransmitTower
        ]

        return types.filter((type) => {
            if (type === station.type) {
                return false
            }
            switch (type) {
                case StationType.EnergyNode:
                    return playerState.energyNodes.length > 0
                case StationType.SundiverFoundry:
                    return playerState.sundiverFoundries.length > 0
                case StationType.TransmitTower:
                    return playerState.transmitTowers.length > 0
                default:
                    return false
            }
        })
    })

    async function chooseMetamorphosisType(type: StationType) {
        choiceMade = true
        picker.toggle()
        gameSession.metamorphosisType = type
        await gameSession.metamorphosize()
    }

    async function onClose() {
        if (choiceMade) {
            return
        }
        await gameSession.undo()
    }
</script>

<SolPicker bind:this={picker} {onClose} trigger="manual">
    <div class="text-center mb-2">WHICH TYPE?</div>
    <div class="flex flex-row flex-wrap justify-center items-end gap-x-2">
        {#if stationTypes.includes(StationType.EnergyNode)}
            <div class="flex flex-col items-center">
                <button onclick={() => chooseMetamorphosisType(StationType.EnergyNode)}>
                    <EnergyNode
                        width={46}
                        height={48}
                        color={gameSession.colors.getPlayerColor(gameSession.myPlayer?.id)}
                    />
                </button>
                <div class="mt-1 text-[.5rem] tracking-widest text-center leading-none">
                    ENERGY<br />NODE
                </div>
            </div>
        {/if}
        {#if stationTypes.includes(StationType.SundiverFoundry)}
            <div class="flex flex-col items-center">
                <button onclick={() => chooseMetamorphosisType(StationType.SundiverFoundry)}>
                    <Foundry
                        width={46}
                        height={48}
                        color={gameSession.colors.getPlayerColor(gameSession.myPlayer?.id)}
                    />
                </button>
                <div class="mt-1 text-[.5rem] tracking-widest text-center leading-none">
                    SUNDIVER<br />FOUNDRY
                </div>
            </div>
        {/if}
        {#if stationTypes.includes(StationType.TransmitTower)}
            <div class="flex flex-col items-center">
                <button onclick={() => chooseMetamorphosisType(StationType.TransmitTower)}>
                    <Tower
                        width={40}
                        height={80}
                        color={gameSession.colors.getPlayerColor(gameSession.myPlayer?.id)}
                    />
                </button>
                <div class="mt-1 text-[.5rem] tracking-widest text-center leading-none">
                    TRANSMIT<br />TOWER
                </div>
            </div>
        {/if}
    </div>
</SolPicker>
