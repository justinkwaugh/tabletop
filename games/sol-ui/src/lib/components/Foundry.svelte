<script lang="ts">
    import FoundryIcon from '$lib/images/foundry.svelte'
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
    transform="{translateFromCenter(location.x, location.y)} scale(.50) translate(-46.5, -50)"
>
    <FoundryIcon class={color} />
</g>
