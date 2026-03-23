<script lang="ts">
    const BASE_WIDTH = 230.04
    const BASE_HEIGHT = 15.49
    const CROSS_PATH =
        'M108.3.15l-5.97-.15-4.75.18-10.13-.15c-1.66-.03-3.93.66-5.5.85-1.12.14-3.26-1.45-10.8-.22-1.6.26-3.07.28-4.64.27h-5.1c-1.8-.02-3.76,0-5.53.11l-8.08.53-7.71.64C35.22,2.62-.29,12.87,0,14c0,0,5.65,1.21,7.56,1.35,8.05.6,32.28-.91,32.28-.91,3.29-.52,9.62-1.29,12.92-2.07,5.81-1.38,12.05-.64,17.91-1.34,3.61-.43,5.12.59,8.66.35l7.6-.52c2.81-.19,5.1-.32,8.19-.1l30.48-1.76,3.96-.38,2.96.21c2.19.15,5.05.06,7.29-.17l1.33.98c.3.22,1.21-.3,1.64-.35,5.21-.56,10.36.04,15.7.17l3.74.09c1.75.04,3.46.29,5.25.43l14.39,1.18,10.67.28,33.47,2.29c1.02.07,2.69-.62,4.06-1.05-3.68-3.35-16.45-3.98-21.5-4.49l-11.13-1.13-4.73-.6c-5.97-.76-11.62-1.26-17.58-1.67l-7.63-.52c-1.53-.1-2.87-.39-4.38-.55l-15.97-1.69c-3.04-.32-5.6-.1-9.27-1.03l-29.54-.86Z'

    let {
        x = 0,
        y = 0,
        width = BASE_WIDTH,
        verticalScale = 1,
        opacity = 0.92,
        shadowOpacity = 0.34,
        shadowDx = 5,
        shadowDy = 4
    }: {
        x?: number
        y?: number
        width?: number
        verticalScale?: number
        opacity?: number
        shadowOpacity?: number
        shadowDx?: number
        shadowDy?: number
    } = $props()

    const scale = $derived(width / BASE_WIDTH)
    const shadowTranslate = $derived(`${shadowDx / scale} ${shadowDy / scale}`)
    const verticalCenterOffset = $derived((BASE_HEIGHT * (1 - verticalScale)) / 2)
</script>

<g transform={`translate(${x} ${y}) scale(${scale})`}>
    <g transform={`translate(0 ${verticalCenterOffset}) scale(1 ${verticalScale})`}>
        <path
            d={CROSS_PATH}
            fill="rgba(255, 250, 241, 0.38)"
            opacity={shadowOpacity}
            transform={`translate(${shadowTranslate})`}
        />
        <path d={CROSS_PATH} fill="currentColor" opacity={opacity} />
    </g>
</g>
