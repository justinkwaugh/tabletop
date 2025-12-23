<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { StationType } from '@tabletop/sol'
    import Tower from '$lib/images/tower.svelte'
    import Foundry from '$lib/images/foundry.svelte'
    import EnergyNode from '$lib/images/energynode.svelte'
    import Floater from '$lib/utils/Floater.svelte'

    let gameSession = getContext('gameSession') as SolGameSession

    let station = $derived(gameSession.gameState.getActivatingStation())

    let stationTypes = $derived.by(() => {
        const playerState = gameSession.myPlayerState
        if (!playerState) {
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
        gameSession.metamorphosisType = type
        await gameSession.metamorphosize()
    }

    async function onClose() {
        await gameSession.undo()
    }
</script>

<Floater placement="top" reference={`#board-picker-ref`} offset={20} trigger="manual" {onClose}>
    <div
        class="flex flex-col justify-center items-center space-y-2 rounded-lg dark:bg-black/90 p-2 text-[#ad9c80] border-1 border-[#ad9c80]"
    >
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
    </div>
</Floater>
