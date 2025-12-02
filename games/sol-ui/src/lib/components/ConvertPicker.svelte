<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { HydratedConvert } from '@tabletop/sol'
    import Gate from '$lib/images/gate.svelte'
    import Tower from '$lib/images/tower.svelte'
    import Foundry from '$lib/images/foundry.svelte'
    import EnergyNode from '$lib/images/energynode.svelte'
    import { ConvertType } from '$lib/definition/convertType.js'

    let gameSession = getContext('gameSession') as SolGameSession

    const canConvertSolarGate = $derived(
        HydratedConvert.canConvertSolarGate(gameSession.gameState, gameSession.myPlayer?.id ?? '')
    )

    const canConvertEnergyNode = $derived(
        HydratedConvert.canConvertEnergyNode(gameSession.gameState, gameSession.myPlayer?.id ?? '')
    )

    const canConvertSundiverFoundry = $derived(
        HydratedConvert.canConvertSundiverFoundry(
            gameSession.gameState,
            gameSession.myPlayer?.id ?? ''
        )
    )

    const canConvertTransmitTower = $derived(
        HydratedConvert.canConvertTransmitTower(
            gameSession.gameState,
            gameSession.myPlayer?.id ?? ''
        )
    )

    function chooseConvertType(type: ConvertType) {
        gameSession.chosenConvertType = type
    }
</script>

<div class="flex flex-row flex-wrap justify-center items-end gap-x-2 mb-2">
    {#if canConvertSolarGate}
        <div class="flex flex-col items-center">
            <button onclick={() => chooseConvertType(ConvertType.SolarGate)}>
                <Gate
                    width={41}
                    height={36}
                    color={gameSession.colors.getPlayerColor(gameSession.myPlayer?.id)}
                />
            </button>
            <div class="mt-1 text-[.5rem] tracking-widest text-center leading-none">
                SOLAR<br />GATE
            </div>
        </div>
    {/if}
    {#if canConvertEnergyNode}
        <div class="flex flex-col items-center">
            <button onclick={() => chooseConvertType(ConvertType.EnergyNode)}>
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
    {#if canConvertSundiverFoundry}
        <div class="flex flex-col items-center">
            <button onclick={() => chooseConvertType(ConvertType.SundiverFoundry)}>
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
    {#if canConvertTransmitTower}
        <div class="flex flex-col items-center">
            <button onclick={() => chooseConvertType(ConvertType.TransmitTower)}>
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
