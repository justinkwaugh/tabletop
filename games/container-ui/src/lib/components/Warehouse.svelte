<script lang="ts">
    import warehouseImg from '$lib/images/warehouse.svg'

    const WAREHOUSE_WIDTH = 56.69
    const WAREHOUSE_HEIGHT = 66.31

    let {
        x,
        y,
        width,
        heightOverride,
        rotation = 0
    }: {
        x: number
        y: number
        width: number
        heightOverride?: number
        rotation?: number
    } = $props()

    const height = $derived(heightOverride ?? width * (WAREHOUSE_HEIGHT / WAREHOUSE_WIDTH))
    const transform = $derived.by(() => {
        if (rotation === 0) {
            return undefined
        }

        const centerX = x + width / 2
        const centerY = y + height / 2
        return `translate(${centerX} ${centerY}) rotate(${rotation}) translate(${-width / 2} ${-height / 2})`
    })
</script>

{#if transform}
    <g transform={transform}>
        <image
            href={warehouseImg}
            x="0"
            y="0"
            width={width}
            height={height}
            preserveAspectRatio="none"
        ></image>
    </g>
{:else}
    <image
        href={warehouseImg}
        x={x}
        y={y}
        width={width}
        height={height}
        preserveAspectRatio="none"
    ></image>
{/if}
