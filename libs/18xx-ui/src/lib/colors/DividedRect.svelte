<script lang="ts">
    let {
        x,
        y,
        width,
        height,
        rx = 0,
        fills,
        stroke,
        strokeWidth
    }: {
        x: number
        y: number
        width: number
        height: number
        rx?: number
        fills: readonly string[]
        stroke: string
        strokeWidth: number
    } = $props()
    const clipId = $props.id()
    // Each split leans like a forward slash, as printed.
    const lean = $derived(height * 0.18)
    const boundary = (index: number) =>
        index === 0
            ? x - lean
            : index === fills.length
              ? x + width + lean
              : x + (index * width) / fills.length
    const part = (index: number) =>
        [
            `${boundary(index) + lean},${y}`,
            `${boundary(index + 1) + lean},${y}`,
            `${boundary(index + 1) - lean},${y + height}`,
            `${boundary(index) - lean},${y + height}`
        ].join(' ')
</script>

{#if fills.length === 1}
    <rect {x} {y} {width} {height} {rx} fill={fills[0]} {stroke} stroke-width={strokeWidth}></rect>
{:else}
    <clipPath id={clipId}>
        <rect {x} {y} {width} {height} {rx}></rect>
    </clipPath>
    <g clip-path={`url(#${clipId})`} data-divided-fill>
        {#each fills as fill, index (index)}
            <polygon points={part(index)} {fill}></polygon>
        {/each}
    </g>
    <rect {x} {y} {width} {height} {rx} fill="none" {stroke} stroke-width={strokeWidth}></rect>
{/if}
