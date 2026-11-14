<script lang="ts">
    import { cubeShadingIds } from '$lib/utils/cubeShape.js'

    let { prefix }: { prefix: string } = $props()

    const ids = $derived(cubeShadingIds(prefix))
</script>

<!-- Art plan, Cube: the wood look is three gradients laid over each cube's faces, shared by every
     cube in this SVG; no filter, mask or texture. -->
<defs>
    <linearGradient id={ids.top} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="var(--rtr-cube-sheen)" stop-opacity="0.34"></stop>
        <stop offset="0.6" stop-color="var(--rtr-cube-sheen)" stop-opacity="0"></stop>
        <stop offset="1" stop-color="var(--rtr-cube-shade)" stop-opacity="0.08"></stop>
    </linearGradient>
    <linearGradient id={ids.left} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--rtr-cube-shade)" stop-opacity="0.12"></stop>
        <stop offset="1" stop-color="var(--rtr-cube-shade)" stop-opacity="0.36"></stop>
    </linearGradient>
    <linearGradient id={ids.right} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--rtr-cube-shade)" stop-opacity="0.34"></stop>
        <stop offset="1" stop-color="var(--rtr-cube-shade)" stop-opacity="0.54"></stop>
    </linearGradient>
</defs>
