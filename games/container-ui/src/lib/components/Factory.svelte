<script lang="ts">
    const FACTORY_WIDTH = 61.49
    const FACTORY_HEIGHT = 105.92
    const STROKE = '#312726'
    const DARK_FILL = '#121820'
    const DEEP_FILL = '#312726'
    const SHADE_MULTIPLIER = 0.584

    let {
        x,
        y,
        width,
        height,
        color,
        rotation = 0
    }: {
        x: number
        y: number
        width?: number
        height?: number
        color: string
        rotation?: number
    } = $props()

    const resolvedWidth = $derived.by(() => {
        if (width !== undefined) {
            return width
        }

        if (height !== undefined) {
            return height * (FACTORY_WIDTH / FACTORY_HEIGHT)
        }

        return FACTORY_WIDTH
    })
    const resolvedHeight = $derived.by(() => {
        if (height !== undefined) {
            return height
        }

        if (width !== undefined) {
            return width * (FACTORY_HEIGHT / FACTORY_WIDTH)
        }

        return FACTORY_HEIGHT
    })
    const shadedColor = $derived(scaleHexColor(color, SHADE_MULTIPLIER))
    const transform = $derived.by(() => {
        if (rotation === 0) {
            return `translate(${x} ${y})`
        }

        const centerX = x + resolvedWidth / 2
        const centerY = y + resolvedHeight / 2
        return `translate(${centerX} ${centerY}) rotate(${rotation}) translate(${-resolvedWidth / 2} ${-resolvedHeight / 2})`
    })

    function scaleHexColor(input: string, multiplier: number): string {
        const normalized = input.trim()
        const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized
        if (hex.length !== 6) {
            return input
        }

        const red = Number.parseInt(hex.slice(0, 2), 16)
        const green = Number.parseInt(hex.slice(2, 4), 16)
        const blue = Number.parseInt(hex.slice(4, 6), 16)
        if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
            return input
        }

        const scaled = [red, green, blue]
            .map((channel) => Math.max(0, Math.min(255, Math.round(channel * multiplier))))
            .map((channel) => channel.toString(16).padStart(2, '0'))
            .join('')

        return `#${scaled}`
    }
</script>

<g transform={transform}>
    <g transform={`scale(${resolvedWidth / FACTORY_WIDTH} ${resolvedHeight / FACTORY_HEIGHT})`}>
        <g>
            <rect
                x=".44"
                y="81.34"
                width="60.63"
                height="24.21"
                fill={color}
                stroke={STROKE}
                stroke-miterlimit="10"
                stroke-width=".75"
            ></rect>
            <polygon
                points="61.07 81.34 .44 81.34 5.13 53 57.74 53 61.07 81.34"
                fill={shadedColor}
                stroke={STROKE}
                stroke-miterlimit="10"
                stroke-width=".75"
            ></polygon>
        </g>
        <g>
            <rect x="43.07" y="96.11" width="9.83" height="9.43" fill={DEEP_FILL}></rect>
            <rect x="10.54" y="101.6" width="20.21" height="3.73" fill={DEEP_FILL}></rect>
        </g>
        <g>
            <rect x="44.57" y="99.93" width="2.86" height="5.37" fill={color}></rect>
            <rect x="48.73" y="99.93" width="2.86" height="5.37" fill={color}></rect>
            <rect
                x="51.75"
                y="83.68"
                width="5.34"
                height="5.12"
                fill={color}
                stroke={STROKE}
                stroke-miterlimit="10"
                stroke-width=".75"
            ></rect>
            <polygon
                points="12.92 73.05 6.37 73.05 7.3 66.77 13.34 66.77 12.92 73.05"
                fill={color}
                stroke={STROKE}
                stroke-miterlimit="10"
                stroke-width=".75"
            ></polygon>
            <rect
                x="6.37"
                y="73.05"
                width="6.55"
                height="3.14"
                fill={color}
                stroke={STROKE}
                stroke-miterlimit="10"
                stroke-width=".75"
            ></rect>
        </g>
        <g>
            <path
                d="M33.71,20.51h-15.26v44.84h.08c0,6.58,15.09,6.58,15.1,0h.08V20.51Z"
                fill={color}
                stroke={STROKE}
                stroke-miterlimit="10"
                stroke-width=".75"
            ></path>
            <path
                d="M33.64,20.51c.17,6.73-15.29,6.73-15.12,0-.17-6.73,15.29-6.73,15.12,0Z"
                fill={color}
                stroke={STROKE}
                stroke-miterlimit="10"
                stroke-width=".75"
            ></path>
            <path
                d="M33.64,26.48c.17,6.73-15.29,6.73-15.12,0"
                fill="none"
                stroke={STROKE}
                stroke-miterlimit="10"
                stroke-width=".75"
            ></path>
            <path
                d="M31.94,20.51c.13,5.21-11.85,5.21-11.71,0-.13-5.21,11.85-5.21,11.71,0Z"
                fill={shadedColor}
                stroke={STROKE}
                stroke-miterlimit="10"
                stroke-width=".75"
            ></path>
        </g>
        <g>
            <path
                d="M52.9,5.42h-15.26v44.84l.08,15.09c.09,2.82,3.43,5.08,7.55,5.08s7.46-2.27,7.55-5.08l.08-15.09V5.42Z"
                fill={color}
                stroke={STROKE}
                stroke-miterlimit="10"
                stroke-width=".75"
            ></path>
            <path
                d="M52.83,5.42c.17,6.73-15.29,6.73-15.12,0-.17-6.73,15.29-6.73,15.12,0Z"
                fill={color}
                stroke={STROKE}
                stroke-miterlimit="10"
                stroke-width=".75"
            ></path>
            <path
                d="M52.83,11.4c.17,6.73-15.29,6.73-15.12,0"
                fill="none"
                stroke={STROKE}
                stroke-miterlimit="10"
                stroke-width=".75"
            ></path>
            <path
                d="M51.13,5.42c.13,5.21-11.85,5.21-11.71,0-.13-5.21,11.85-5.21,11.71,0Z"
                fill={shadedColor}
                stroke={STROKE}
                stroke-miterlimit="10"
                stroke-width=".75"
            ></path>
        </g>
        <rect x="10.54" y="98.41" width="20.21" height="2.27" fill={DEEP_FILL}></rect>
        <rect x="10.54" y="95.25" width="20.21" height="2.24" fill={DEEP_FILL}></rect>
        <rect
            x="9.65"
            y="94.12"
            width="22.01"
            height="11.43"
            fill="none"
            stroke={STROKE}
            stroke-miterlimit="10"
            stroke-width=".5"
        ></rect>
        <line
            x1="46"
            y1="100.83"
            x2="46"
            y2="105.29"
            stroke={STROKE}
            stroke-miterlimit="10"
            stroke-width=".5"
        ></line>
        <line
            x1="50.16"
            y1="100.83"
            x2="50.16"
            y2="105.29"
            stroke={DARK_FILL}
            stroke-miterlimit="10"
            stroke-width=".5"
        ></line>
        <line
            x1="44.57"
            y1="100.96"
            x2="51.59"
            y2="100.96"
            stroke={STROKE}
            stroke-miterlimit="10"
            stroke-width=".5"
        ></line>
        <rect
            x="38.82"
            y="83.68"
            width="5.34"
            height="5.12"
            fill={color}
            stroke={STROKE}
            stroke-miterlimit="10"
            stroke-width=".75"
        ></rect>
        <rect
            x="45.32"
            y="83.68"
            width="5.34"
            height="5.12"
            fill={color}
            stroke={STROKE}
            stroke-miterlimit="10"
            stroke-width=".75"
        ></rect>
    </g>
</g>
