<script lang="ts">
    import EnergyNodeIcon from '$lib/images/energynode.svelte'
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
    transform="{translateFromCenter(location.x, location.y)} scale(.35) translate(-46.5, -50)"
>
    <EnergyNodeIcon class={color} />
</g>
