<script lang="ts">
    const CONTAINER_WIDTH = 23.83
    const CONTAINER_HEIGHT = 65.28
    const STROKE = '#332626'

    let {
        x,
        y,
        height,
        color,
        rotation = 0
    }: {
        x: number
        y: number
        height: number
        color: string
        rotation?: number
    } = $props()

    const width = $derived(height * (CONTAINER_WIDTH / CONTAINER_HEIGHT))
    const transform = $derived.by(() => {
        if (rotation === 0) {
            return `translate(${x} ${y})`
        }

        const centerX = x + width / 2
        const centerY = y + height / 2
        return `translate(${centerX} ${centerY}) rotate(${rotation}) translate(${-width / 2} ${-height / 2})`
    })
</script>

<g transform={transform}>
    <g transform={`scale(${width / CONTAINER_WIDTH} ${height / CONTAINER_HEIGHT})`}>
        <rect
            x=".25"
            y="41.7"
            width="23.33"
            height="23.33"
            fill={color}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".5"
        ></rect>
        <rect
            x="2.71"
            y="44.17"
            width="18.4"
            height="18.4"
            transform="translate(-41.45 65.28) rotate(-90)"
            fill={color}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".5"
        ></rect>
        <rect
            x=".25"
            y=".25"
            width="23.33"
            height="41.45"
            fill={color}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".5"
        ></rect>
        <line
            x1="11.59"
            y1="44.17"
            x2="11.59"
            y2="62.57"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".5"
        ></line>
        <line x1="10.24" y1="47.86" x2="4.28" y2="47.86" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
        <line x1="10.24" y1="53.37" x2="4.28" y2="53.37" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
        <line x1="10.24" y1="59.93" x2="4.28" y2="59.93" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
        <line x1="19.34" y1="47.86" x2="13.39" y2="47.86" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
        <line x1="19.34" y1="53.37" x2="13.39" y2="53.37" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
        <line x1="19.34" y1="59.93" x2="13.39" y2="59.93" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
    </g>
</g>
