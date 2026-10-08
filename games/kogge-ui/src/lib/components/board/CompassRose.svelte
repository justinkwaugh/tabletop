<script lang="ts">
    let { x, y, size }: { x: number; y: number; size: number } = $props()

    const points = (count: number, outer: number, inner: number, offset: number) =>
        Array.from({ length: count }, (_, index) => {
            const angle = offset + (index * 2 * Math.PI) / count
            const half = Math.PI / count
            const tip = [Math.cos(angle) * outer, Math.sin(angle) * outer]
            const left = [Math.cos(angle - half) * inner, Math.sin(angle - half) * inner]
            const right = [Math.cos(angle + half) * inner, Math.sin(angle + half) * inner]
            return { tip, left, right }
        })

    const major = points(4, 1, 0.16, -Math.PI / 2)
    const minor = points(4, 0.66, 0.13, -Math.PI / 4)
    const fine = points(8, 0.44, 0.1, -Math.PI / 2 + Math.PI / 8)
</script>

<g transform="translate({x} {y}) scale({size / 2})" stroke="#3b2814" stroke-width="0.012">
    <circle r="0.74" fill="#f2e6c5" fill-opacity="0.75"></circle>
    <circle r="0.74" fill="none" stroke-width="0.02"></circle>
    <circle r="0.68" fill="none"></circle>
    {#each Array.from({ length: 32 }, (_, index) => index) as tick (tick)}
        <line
            x1={Math.cos((tick * Math.PI) / 16) * 0.68}
            y1={Math.sin((tick * Math.PI) / 16) * 0.68}
            x2={Math.cos((tick * Math.PI) / 16) * (tick % 4 === 0 ? 0.6 : 0.64)}
            y2={Math.sin((tick * Math.PI) / 16) * (tick % 4 === 0 ? 0.6 : 0.64)}
        ></line>
    {/each}
    {#each fine as point, index (index)}
        <path
            d="M0 0 L{point.left[0]} {point.left[1]} L{point.tip[0]} {point.tip[1]} L{point
                .right[0]} {point.right[1]} Z"
            fill="#7a5a33"
        ></path>
    {/each}
    {#each minor as point, index (index)}
        <path
            d="M0 0 L{point.left[0]} {point.left[1]} L{point.tip[0]} {point.tip[1]} Z"
            fill="#2c1e10"
        ></path>
        <path
            d="M0 0 L{point.tip[0]} {point.tip[1]} L{point.right[0]} {point.right[1]} Z"
            fill="#efe2bf"
        ></path>
    {/each}
    {#each major as point, index (index)}
        <path
            d="M0 0 L{point.left[0]} {point.left[1]} L{point.tip[0]} {point.tip[1]} Z"
            fill={index === 0 ? '#a32a22' : '#2c1e10'}
        ></path>
        <path
            d="M0 0 L{point.tip[0]} {point.tip[1]} L{point.right[0]} {point.right[1]} Z"
            fill="#efe2bf"
        ></path>
    {/each}
    <circle r="0.06" fill="#a32a22"></circle>
    <text
        y="-1.08"
        text-anchor="middle"
        font-family="IM Fell English"
        font-size="0.3"
        fill="#3b2814"
        stroke="none">N</text
    >
</g>
