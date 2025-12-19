<script lang="ts">
    import EnergyNode from '$lib/images/energynode.svelte'
    import EnergyNodeMask from '$lib/images/energynodeMask.svelte'
    import Foundry from '$lib/images/foundry.svelte'
    import FoundryMask from '$lib/images/foundryMask.svelte'
    import Tower from '$lib/images/tower.svelte'
    import TowerMask from '$lib/images/towerMask.svelte'
    import { Station, StationType } from '@tabletop/sol'

    let {
        station,
        color,
        width,
        height
    }: {
        station: Station
        color: string
        width?: number
        height?: number
    } = $props()

    let actualWidth = width ?? (station.type === StationType.TransmitTower ? 48 : 46)
    let actualHeight = height ?? (station.type === StationType.TransmitTower ? 100 : 48)
</script>

<g transform="translate({-actualWidth / 2}, {-actualHeight / 2})">
    {#if station.type === StationType.EnergyNode}
        <g transform="translate(-2, -2)">
            <EnergyNodeMask
                width={actualWidth + 4}
                height={actualHeight + 4}
                fill={'black'}
                opacity=".5"
                overflow="visible"
                style="filter: url(#pieceshadow)"
            />
        </g>
        <EnergyNode id={station.id} width={actualWidth} height={actualHeight} {color} />
    {:else if station.type === StationType.SundiverFoundry}
        <g transform="translate(-2, -2)">
            <FoundryMask
                width={actualWidth + 4}
                height={actualHeight + 4}
                fill={'black'}
                opacity=".5"
                overflow="visible"
                style="filter: url(#pieceshadow)"
            />
        </g>
        <Foundry width={actualWidth} height={actualHeight} {color} />
    {:else if station.type === StationType.TransmitTower}
        <g transform="translate(-2, -2)">
            <TowerMask
                width={actualWidth + 4}
                height={actualHeight + 4}
                fill={'black'}
                opacity=".5"
                overflow="visible"
                style="filter: url(#pieceshadow)"
            />
        </g>
        <Tower width={actualWidth} height={actualHeight} {color} />
    {/if}
</g>
