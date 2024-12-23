<script lang="ts">
    import TowerIcon from '$lib/images/tower.svelte'
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
    transform="{translateFromCenter(location.x, location.y)} scale(.9) translate(-24, -50)"
>
    <TowerIcon />
</g>
