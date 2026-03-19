<script module lang="ts">
    export const DEFAULT_BOAT_RENDER_WIDTH = 195.05
</script>

<script lang="ts">
    import Container from '$lib/components/Container.svelte'

    const BOAT_WIDTH = 252.52
    const BOAT_HEIGHT = 63.16
    const STROKE = '#332626'
    const CENTER_FILL = '#332626'
    const PRIMARY_SHADE_MULTIPLIER = 0.88
    const MID_SHADE_MULTIPLIER = 0.786
    const DARK_SHADE_MULTIPLIER = 0.671
    const BRIGHT_YELLOW_DARK_SHADE_MULTIPLIER = 0.42
    const CONTAINER_HEIGHT = 60
    const CONTAINER_OFFSET_X = 56
    const CONTAINER_OFFSET_Y = -1
    const CONTAINER_SPACING = 27.25

    let {
        x,
        y,
        width = DEFAULT_BOAT_RENDER_WIDTH,
        color,
        containerColors = [],
        rotation = 0
    }: {
        x: number
        y: number
        width?: number
        color: string
        containerColors?: string[]
        rotation?: number
    } = $props()

    const height = $derived(width * (BOAT_HEIGHT / BOAT_WIDTH))
    const boatBaseColor = $derived(adjustBoatBaseColor(color))
    const primaryShade = $derived(scaleHexColor(boatBaseColor, PRIMARY_SHADE_MULTIPLIER))
    const midShade = $derived(scaleHexColor(boatBaseColor, MID_SHADE_MULTIPLIER))
    const darkShade = $derived(
        scaleHexColor(
            boatBaseColor,
            isBrightYellow(boatBaseColor)
                ? BRIGHT_YELLOW_DARK_SHADE_MULTIPLIER
                : DARK_SHADE_MULTIPLIER
        )
    )
    const transform = $derived.by(() => {
        if (rotation === 0) {
            return `translate(${x} ${y})`
        }

        const centerX = x + width / 2
        const centerY = y + height / 2
        return `translate(${centerX} ${centerY}) rotate(${rotation}) translate(${-width / 2} ${-height / 2})`
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

    function isBrightYellow(input: string): boolean {
        const normalized = input.trim()
        const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized
        if (hex.length !== 6) {
            return false
        }

        const red = Number.parseInt(hex.slice(0, 2), 16)
        const green = Number.parseInt(hex.slice(2, 4), 16)
        const blue = Number.parseInt(hex.slice(4, 6), 16)
        if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
            return false
        }

        return red > 200 && green > 180 && blue < 120
    }

    function adjustBoatBaseColor(input: string): string {
        const rgb = parseHexColor(input)
        if (!rgb) {
            return input
        }

        const hsl = rgbToHsl(rgb.red, rgb.green, rgb.blue)
        const isPinkish =
            hsl.saturation > 0.45 &&
            hsl.lightness > 0.45 &&
            (hsl.hue >= 330 || hsl.hue <= 10)

        if (!isPinkish) {
            return input
        }

        return hslToHex(
            hsl.hue,
            Math.max(0, Math.min(1, hsl.saturation * 0.86)),
            hsl.lightness
        )
    }

    function parseHexColor(input: string) {
        const normalized = input.trim()
        const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized
        if (hex.length !== 6) {
            return null
        }

        const red = Number.parseInt(hex.slice(0, 2), 16)
        const green = Number.parseInt(hex.slice(2, 4), 16)
        const blue = Number.parseInt(hex.slice(4, 6), 16)
        if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
            return null
        }

        return { red, green, blue }
    }

    function rgbToHsl(red: number, green: number, blue: number) {
        const r = red / 255
        const g = green / 255
        const b = blue / 255
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const lightness = (max + min) / 2
        const delta = max - min

        if (delta === 0) {
            return { hue: 0, saturation: 0, lightness }
        }

        const saturation =
            lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)

        let hue = 0
        switch (max) {
            case r:
                hue = (g - b) / delta + (g < b ? 6 : 0)
                break
            case g:
                hue = (b - r) / delta + 2
                break
            default:
                hue = (r - g) / delta + 4
                break
        }

        return { hue: hue * 60, saturation, lightness }
    }

    function hslToHex(hue: number, saturation: number, lightness: number): string {
        const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
        const huePrime = hue / 60
        const x = chroma * (1 - Math.abs((huePrime % 2) - 1))

        let redPrime = 0
        let greenPrime = 0
        let bluePrime = 0

        if (huePrime >= 0 && huePrime < 1) {
            redPrime = chroma
            greenPrime = x
        } else if (huePrime < 2) {
            redPrime = x
            greenPrime = chroma
        } else if (huePrime < 3) {
            greenPrime = chroma
            bluePrime = x
        } else if (huePrime < 4) {
            greenPrime = x
            bluePrime = chroma
        } else if (huePrime < 5) {
            redPrime = x
            bluePrime = chroma
        } else {
            redPrime = chroma
            bluePrime = x
        }

        const match = lightness - chroma / 2
        const red = Math.round((redPrime + match) * 255)
        const green = Math.round((greenPrime + match) * 255)
        const blue = Math.round((bluePrime + match) * 255)

        return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
    }
</script>

<g {transform}>
    <g transform={`scale(${width / BOAT_WIDTH} ${height / BOAT_HEIGHT})`}>
        <path
            fill={primaryShade}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M49.97,62.73c66.14-1.09,132.41,1.55,198.51-1.54,4.21-.01,3.64-4.79,3.59-7.86,0-15.56,0-31.11,0-46.67,0-3.49-1.47-4.92-4.96-4.97C185.06-.06,122.98.89,60.91.66c-7.24-.13-14.56-.81-21.71.75C23.39,4.59-.34,14.55.42,33.66c4.21,19.24,31.78,28.9,49.38,29.07"
        ></path>
        <path
            fill={primaryShade}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M207.1,59.31l39.33-1.16c1.35-.04,1.74-.48,1.73-1.75-.03-16.52-.04-33.05,0-49.58.01-1.16-.16-1.71-1.56-1.75l-39.67-1.16"
        ></path>
        <path
            fill={primaryShade}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M207.1,52.99c9.75,0,19.49,0,29.24,0,2.34,0,2.74-.4,2.74-2.73,0-12.54,0-25.07,0-37.61,0-2.04-.35-2.39-2.39-2.39-9.86,0-19.72,0-29.58,0"
        ></path>
        <path
            fill={primaryShade}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M49.8,3.41C33.26,4.01,11.14,11.66,4.76,28.38c-3.14,15.65,19.75,26.34,32.21,29.18,3.46.79,7.19,1.94,12.83,2.28V3.41Z"
        ></path>
        <path
            fill={primaryShade}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M208.76,50.94c.06,2.74.2,5.47.1,8.2-.02.57.36,1.48-2.24,1.53l-8.94.19c-5.52-.01-5.63.62-5.51-1.04.04-18,0-36.02.01-54.02,0-3.42,0-3.4,3.42-3.43l12.51.17c.44,0,.79.37.78.8l-.12,8.95"
        ></path>
        <path
            fill={primaryShade}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M37.83,27.52c-3.04-.64-6.15-.14-9.23-.18-2.17.03-3.3,1.07-3.23,3.25-.22,2.13-.15,5.35,2.88,5.32,2.68,0,5.36.19,8.03.11,2.38-.46,6.13,1.68,6.48-2.01.02-2.43.6-5.03-1.18-7.01"
        ></path>
        <path
            fill={primaryShade}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M38,27.86c.14,1.05-.25,1.45-1.37,1.39-2.45-.13-4.9-.16-7.35-.19-2.24-.25-2.07,1.54-2.06,3.24-.07,1.22.49,1.74,1.71,1.72,2.51-.04,5.02.09,7.52-.05,1.35-.08,1.7.4,1.54,1.58"
        ></path>
        <rect
            x="54.75"
            y="4.27"
            width="134.08"
            height="55.56"
            fill={darkShade}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
        ></rect>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M133.89,59.83c-.22-17.72-.25-38.01-.14-55.73"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M137.51,14.35c7.98,0,15.96,0,23.94,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M137.51,17.43c7.98,0,15.96,0,23.94,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M137.51,30.08c7.98,0,15.96,0,23.94,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M137.51,33.16c7.98,0,15.96,0,23.94,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M109.81,14.18c7.96.43,15.96.05,23.94.17"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M137.51,45.81c7.98,0,15.96,0,23.94,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M109.81,17.43c7.98,0,15.96,0,23.94,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M137.51,48.89c7.98,0,15.96,0,23.94,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M109.81,30.08c7.98,0,15.96,0,23.94,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M109.81,33.16c7.98,0,15.96,0,23.94,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M109.81,45.81c7.98,0,15.96,0,23.94,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M109.81,48.89c7.98,0,15.96,0,23.94,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M82.11,48.89c7.98,0,15.96,0,23.94,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M82.11,45.81c7.98,0,15.96,0,23.94,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M82.11,33.16c7.98,0,15.96,0,23.94,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M82.11,14.18c7.96.43,15.96.05,23.94.17"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M82.11,17.43c7.98,0,15.96,0,23.94,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M82.11,30.08c7.98,0,15.96,0,23.94,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M55.1,45.64c7.81.31,15.79.31,23.6,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M55.1,33.33c7.84-.43,15.74-.05,23.6-.17"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M55.1,29.91c7.81.31,15.79.31,23.6,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M55.1,17.6c7.84-.43,15.74-.05,23.6-.17"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M55.1,14.18c7.81.31,15.79.31,23.6,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M55.27,48.89c7.81,0,15.62,0,23.42,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M165.04,14.35c7.23-.12,16.58.26,23.79-.17"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M165.04,17.43c7.24,0,16.56-.04,23.79-.04"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M165.04,30.08c7.23-.12,16.58.26,23.79-.17"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M165.04,33.16c7.24,0,16.56.07,23.79.07"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M165.04,45.81c7.23-.12,16.58.26,23.79-.17"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M165.04,48.89c7.24,0,16.56,0,23.79,0"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M41.66,36.46c4.34.81,2.95-4.65,3.18-7.24-.03-2.1-1.13-2.85-3.25-2.42-1.35.12-2.69-.25-3.76.88"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M161.79,59.83c-.07-18.23-.44-37.53.17-55.73"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M137,4.09c.66,18.21.21,37.5.18,55.73"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M81.77,4.27c0,18.18,0,37.38,0,55.56"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M164.7,59.83c0-18.24,0-37.5,0-55.73"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M106.43,59.83c-.13-18.23-.19-37.52.13-55.73"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M109.47,4.27c0,18.18,0,37.38,0,55.56"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M79.03,59.83c0-18.18,0-37.38,0-55.56"
        ></path>
        <path
            fill={midShade}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M243.69,51.79c-3.26.37-2.11,5.17.81,4.03,1.74-1.35,1.64-2.37.03-3.85-.12-.15-.44-.13-.67-.18"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M219.07,12.8c0,12.48,0,24.97,0,37.45"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M54.75,59.83c.23-18.29-.12-37.44.17-55.73"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M205.56,2.56v9.74"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M205.56,50.94c0,3.19,0,6.38,0,9.57"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M213.44,50.42c3.3.45,6.66,0,9.98.19.75.01,1-.39,1-1.56-.02-11.74-.02-23.48,0-35.22,0-1.17-.31-1.23-.9-1.21-3.4.09-6.8.17-10.2.17-5.52-.11-11.04-.16-16.56-.19-.72-.02-.9.28-.89,1.4.03,11.62.03,23.25,0,34.88,0,1.32.26,1.75,1.11,1.73,5.45-.12,10.89-.2,16.34-.19"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M211.66,32.76c1.54,0,1.54-1.15,1.72-2.22.22-1.32-.54-2.29-1.56-2.49-1.39-.27-3.01-.98-4.28.59-.77.96-.94,2.68-.15,3.61.77.92,3.05,1.21,3.93.51,1.03-.98.82-3.52-.17-4.62"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M211.67,46.22c-1.43-2.4-3.74-1.34-2.86.83.83,1.34,1.71,1.15,2.67,0,.14-.13.13-.44.18-.67"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M39.88,27.17c1.36,1.74,1.64,6.96,0,8.89"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M49.28,48.89c1.4.23,1.54-.51,1.59-1.71.05-1.35-.58-1.47-1.59-1.37"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M49.28,33.16c1.4.23,1.54-.51,1.59-1.71.05-1.35-.58-1.47-1.59-1.37"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M49.28,17.43c1.4.23,1.54-.51,1.59-1.71.05-1.35-.58-1.47-1.59-1.37"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M49.8.68v2.74"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M49.8,59.83v2.74"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M34.24,52.48c.75,1.04,1.84.27,2.74.51.57-2.02.22-4.1.36-6.15.09-1.39-.86-1.01-1.56-1.01s-1.63-.38-1.56,1.01c.09,1.82.02,3.65.02,5.47"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M39.71,16.92c.75,1.04,1.84.27,2.74.51.55-2.02.27-4.09.35-6.15.03-.89-.22-1.34-1.21-1.21-.84.11-1.92-.29-1.89,1.21.04,1.82,0,3.65,0,5.47"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M39.71,52.48c.75,1.04,1.84.27,2.74.51.57-2.02.22-4.1.36-6.15.09-1.39-.86-1.01-1.56-1.01s-1.63-.38-1.56,1.01c.09,1.82.02,3.65.02,5.47"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M208.55,16.57c.7,1.91,3.22,1.55,3.18-.51-.34-2.05-2.89-1.52-3.18.34"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M28.77,16.92c.87.98,1.92.51,2.9.3.18-.04.33-.64.34-.98.03-1.65-.06-3.31.04-4.96.08-1.17-.49-1.3-1.4-1.2-.83.09-1.95-.38-1.89,1.2.06,1.82.01,3.65.01,5.47"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M28.77,52.48c.87.98,1.92.5,2.9.31.16-.03.33-.53.33-.82.03-1.71-.03-3.42.03-5.13.05-1.49-1.03-.97-1.72-1-.7-.04-1.63-.39-1.56,1.01.09,1.82.02,3.65.02,5.47"
        ></path>
        <path
            fill={midShade}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M13.72,22.73c.99,3.06,4.26,2.91,5.47.17.11-3.82-4.88-4.39-5.47-.34"
        ></path>
        <path
            fill={midShade}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M13.72,40.85c.9,3.94,5.59,2.95,5.47-.51-.17-1.16-1.44-2.48-2.56-2.35-1.1.13-2.33.36-2.58,1.83-.05.3-.22.57-.33.86"
        ></path>
        <path
            fill={midShade}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M241.47,39.14c1.38,3.52,5.05,1.99,4.37-.49-1.21-2.29-3.53-2.46-4.37.31"
        ></path>
        <path
            fill={midShade}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M241.47,24.1c.62,1.27,1.7,2.67,3.24,1.87.94-.41,1.37-1.26,1.17-2.2-.21-2.03-3.44-2.71-4.08-.52-.07.24-.22.46-.34.69"
        ></path>
        <path
            fill={midShade}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M9.96,32.3c1.41,1.86,2.87,2.44,4.1,1.53,1.02-.76,1.51-1.78,1.03-3.07-1.02-2.98-5.64-1.96-5.13,1.37"
        ></path>
        <path
            fill={midShade}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M241.64,9.57c1.56,3.18,4.29,1.5,4.17-1-1.12-1.97-4.15-2.06-4.17.83"
        ></path>
        <path
            fill="none"
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
            d="M34.24,16.92c.75,1.04,1.84.27,2.74.51.56-2.02.26-4.1.36-6.15.04-.91-.21-1.36-1.21-1.21-.83.12-1.95-.37-1.89,1.21.06,1.82.01,3.65.01,5.47"
        ></path>
        <ellipse
            cx="223.61"
            cy="30.4"
            rx="7.9"
            ry="6.68"
            fill={primaryShade}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
        ></ellipse>
        <circle
            cx="221.43"
            cy="30.21"
            r="5.71"
            fill={primaryShade}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
        ></circle>
        <circle
            cx="221.41"
            cy="30.2"
            r="4.1"
            fill={CENTER_FILL}
            stroke={STROKE}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width=".8"
        ></circle>
        {#each containerColors as containerColor, index (`${index}-${containerColor}`)}
            <Container
                x={CONTAINER_OFFSET_X + index * CONTAINER_SPACING}
                y={CONTAINER_OFFSET_Y}
                height={CONTAINER_HEIGHT}
                color={containerColor}
            />
        {/each}
    </g>
</g>
