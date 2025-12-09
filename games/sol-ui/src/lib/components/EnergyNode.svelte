<script lang="ts">
    import EnergyNodeIcon from '$lib/images/energynode.svelte'
    import EnergyNodeMask from '$lib/images/energynodeMask.svelte'
    import { translateFromCenter } from '$lib/utils/boardGeometry.js'
    import { type Point } from '@tabletop/common'

    let { color, location, onclick }: { color: string; location: Point; onclick?: () => void } =
        $props()

    let onClick = () => {
        if (onclick) {
            onclick()
        }
    }
</script>

<g
    onclick={onClick}
    transform="{translateFromCenter(location.x, location.y)} scale(.5) translate(-46.5, -50)"
>
    <g transform="translate(-2, -2)">
        <EnergyNodeMask
            width={97}
            height={104}
            fill={'black'}
            opacity=".5"
            overflow="visible"
            style="filter: url(#pieceshadow)"
        />
    </g>
    <EnergyNodeIcon class={color} />
</g>
