<script lang="ts">
    import type { VesselType } from '@tabletop/feudum'
    import { assetUrl, vesselAsset } from '$lib/art/assetMap.js'
    import { VesselPaths } from '$lib/utils/pieceShapes.js'
    import PieceFrame from './PieceFrame.svelte'

    let {
        vessel,
        size = 48,
        x,
        y
    }: { vessel: VesselType; size?: number; x?: number; y?: number } = $props()

    const PartTokens = {
        ship: 'var(--feudum-route-ship)',
        submersible: 'var(--feudum-route-submersible)',
        'flying-machine': 'var(--feudum-route-flying)'
    } as const
    let label = $derived(vessel.replace('-', ' '))
</script>

<PieceFrame
    {label}
    url={assetUrl(vesselAsset(vessel))}
    width={size}
    height={(size * 32) / 48}
    viewBox="0 0 48 32"
    {x}
    {y}
>
    <path
        d={VesselPaths[vessel].hull}
        fill="var(--feudum-wood-piece)"
        stroke="var(--feudum-wood-dark)"
    ></path>
    <path
        d={VesselPaths[vessel].part}
        fill={PartTokens[vessel]}
        stroke="var(--feudum-map-ink)"
        stroke-width="0.5"
    ></path>
</PieceFrame>
