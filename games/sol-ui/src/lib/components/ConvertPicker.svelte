<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { HydratedConvert } from '@tabletop/sol'
    import Gate from '$lib/components/Gate.svelte'
    import Tower from '$lib/components/Tower.svelte'
    import Foundry from '$lib/components/Foundry.svelte'
    import { ConvertType } from '$lib/definition/convertType.js'
    import EnergyNode from './EnergyNode.svelte'

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

<div class="flex flex-row flex-wrap justify-center items-center gap-x-2">
    {#if canConvertSolarGate}
        <button onclick={() => chooseConvertType(ConvertType.SolarGate)}>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="41px"
                height="36px"
                viewBox="0 -18 41 36"
            >
                <Gate
                    color={gameSession.colors.getPlayerColor(gameSession.myPlayer?.id)}
                    location={{ x: -640 + 20.5, y: -640 + 18 }}
                />
            </svg>
        </button>
    {/if}
    {#if canConvertEnergyNode}
        <button onclick={() => chooseConvertType(ConvertType.EnergyNode)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="46px" height="48px" viewBox="0 0 34 41">
                <EnergyNode
                    color={gameSession.colors.getPlayerColor(gameSession.myPlayer?.id)}
                    location={{ x: -640 + 19.5, y: -640 + 20.5 }}
                />
            </svg>
        </button>
    {/if}
    {#if canConvertSundiverFoundry}
        <button onclick={() => chooseConvertType(ConvertType.SundiverFoundry)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="46px" height="48px" viewBox="0 0 34 41">
                <Foundry
                    color={gameSession.colors.getPlayerColor(gameSession.myPlayer?.id)}
                    location={{ x: -640 + 19.5, y: -640 + 20.5 }}
                />
            </svg>
        </button>
    {/if}
    {#if canConvertTransmitTower}
        <button onclick={() => chooseConvertType(ConvertType.TransmitTower)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32px" height="42px" viewBox="0 0 32 42">
                <Tower color="green" location={{ x: -640 + 16, y: -640 + 21 }} />
            </svg>
        </button>
    {/if}
</div>
