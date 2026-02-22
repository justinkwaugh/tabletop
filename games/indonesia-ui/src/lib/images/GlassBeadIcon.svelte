<script lang="ts">
    import type { SVGAttributes } from 'svelte/elements'

    type BeadTone = 'amber' | 'red' | 'green'

    const BEAD_TONE_COLORS: Record<
        BeadTone,
        {
            baseHighlight: string
            baseMid: string
            baseDark: string
            baseDeep: string
            rim: string
            lowerBandLight: string
            lowerBandHot: string
            caustic: string
            cutShade: string
            shadow: string
        }
    > = {
        amber: {
            baseHighlight: '#bc6f2b',
            baseMid: '#7c3510',
            baseDark: '#4b1c08',
            baseDeep: '#281006',
            rim: '#3b1709',
            lowerBandLight: '#ffc23a',
            lowerBandHot: '#ff8b09',
            caustic: '#ff9a18',
            cutShade: '#2a0d04',
            shadow: '#1b1106',
        },
        red: {
            baseHighlight: '#b23049',
            baseMid: '#741830',
            baseDark: '#43111e',
            baseDeep: '#22080f',
            rim: '#32101a',
            lowerBandLight: '#ff7da0',
            lowerBandHot: '#ff3d6f',
            caustic: '#ff5f87',
            cutShade: '#26060d',
            shadow: '#1e0b0a',
        },
        green: {
            baseHighlight: '#4f8f2d',
            baseMid: '#2f5d19',
            baseDark: '#1a3510',
            baseDeep: '#0f1d09',
            rim: '#153011',
            lowerBandLight: '#b8ee59',
            lowerBandHot: '#74ca29',
            caustic: '#93e03f',
            cutShade: '#0d1d08',
            shadow: '#0c1709',
        }
    }

    let {
        width = 20,
        height = 20,
        tone = 'amber',
        idSuffix = 'default',
        ...svgProps
    }: {
        width?: number
        height?: number
        tone?: BeadTone
        idSuffix?: string
    } & SVGAttributes<SVGElement> = $props()

    const colors = $derived(BEAD_TONE_COLORS[tone])
    const safeIdSuffix = $derived(idSuffix.replace(/[^a-zA-Z0-9_-]/g, '-'))
    const bodyGradientId = $derived(`glass-bead-body-${tone}-${safeIdSuffix}`)
    const lowerBandGradientId = $derived(`glass-bead-band-${tone}-${safeIdSuffix}`)
    const causticGradientId = $derived(`glass-bead-caustic-${tone}-${safeIdSuffix}`)
</script>

<svg {width} {height} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" {...svgProps}>
    <defs>
        <radialGradient id={bodyGradientId} cx="38%" cy="27%" r="74%">
            <stop offset="0%" stop-color={colors.baseHighlight} />
            <stop offset="42%" stop-color={colors.baseMid} />
            <stop offset="79%" stop-color={colors.baseDark} />
            <stop offset="100%" stop-color={colors.baseDeep} />
        </radialGradient>
        <linearGradient id={lowerBandGradientId} x1="20%" y1="0%" x2="80%" y2="0%">
            <stop offset="0%" stop-color={colors.lowerBandHot} />
            <stop offset="45%" stop-color={colors.lowerBandLight} />
            <stop offset="100%" stop-color={colors.lowerBandHot} />
        </linearGradient>
        <radialGradient id={causticGradientId} cx="50%" cy="78%" r="34%">
            <stop offset="0%" stop-color={colors.caustic} stop-opacity="0.66" />
            <stop offset="72%" stop-color={colors.caustic} stop-opacity="0.1" />
            <stop offset="100%" stop-color={colors.caustic} stop-opacity="0" />
        </radialGradient>
    </defs>

    <ellipse cx="50" cy="82.5" rx="24.5" ry="8.2" fill={colors.shadow} opacity="0.18" />
    <ellipse
        cx="50"
        cy="50"
        rx="32.5"
        ry="32.5"
        fill={`url(#${bodyGradientId})`}
        stroke={colors.rim}
        stroke-width="2.1"
    />

    <ellipse cx="50" cy="41.5" rx="25.5" ry="14" fill={colors.baseDeep} opacity="0.45" />
    <ellipse cx="50" cy="42.2" rx="23.5" ry="11.8" fill={colors.baseDark} opacity="0.3" />

    <ellipse cx="50" cy="68.8" rx="24.6" ry="8.7" fill={`url(#${lowerBandGradientId})`} opacity="0.96" />
    <ellipse cx="50" cy="64.5" rx="24.8" ry="8.9" fill={colors.cutShade} opacity="0.62" />
    <ellipse cx="50" cy="71.3" rx="12.8" ry="4.4" fill={`url(#${causticGradientId})`} />

    <ellipse cx="50.8" cy="69.1" rx="3.4" ry="2.2" fill={colors.baseDark} opacity="0.62" />
    <ellipse cx="30.8" cy="69.6" rx="2.8" ry="1.8" fill={colors.baseDark} opacity="0.53" />

    <path
        d="M27 28c4.8-9.2 19.3-11.7 28.8-5.4c-5.4 5.9-12.3 10.2-20.5 13c-3.8-1.5-6.9-4.2-8.3-7.6Z"
        fill="#fffdf7"
        opacity="0.73"
    />
    <ellipse cx="62" cy="26.2" rx="3.8" ry="1.6" fill="#fffdf7" opacity="0.42" />
    <path
        d="M61 27c2.9 4.4 4.6 9.5 4.9 14.3"
        fill="none"
        stroke="#fffdf7"
        stroke-width="1.4"
        stroke-linecap="round"
        opacity="0.22"
    />
</svg>
