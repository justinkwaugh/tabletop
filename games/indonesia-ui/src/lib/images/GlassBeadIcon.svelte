<script lang="ts">
    import type { SVGAttributes } from 'svelte/elements'

    type BeadTone = 'amber' | 'red' | 'green'

    const BEAD_TONE_COLORS: Record<
        BeadTone,
        {
            baseLight: string
            baseMid: string
            baseDark: string
            baseDeep: string
            topShade: string
            innerGlow: string
            rim: string
            shadow: string
            caustic: string
        }
    > = {
        amber: {
            baseLight: '#ffd575',
            baseMid: '#d27b16',
            baseDark: '#8d3f09',
            baseDeep: '#4a1f04',
            topShade: '#2b1204',
            innerGlow: '#ff9a1a',
            rim: '#5c2c06',
            shadow: '#1b1106',
            caustic: '#ffe6a0'
        },
        red: {
            baseLight: '#ffd4df',
            baseMid: '#d94866',
            baseDark: '#8d1536',
            baseDeep: '#47091f',
            topShade: '#25060f',
            innerGlow: '#ff5477',
            rim: '#4a0f24',
            shadow: '#1e0b0a',
            caustic: '#ffe2ea'
        },
        green: {
            baseLight: '#dcf4bb',
            baseMid: '#66ab39',
            baseDark: '#2f6f23',
            baseDeep: '#163b12',
            topShade: '#0c1d0a',
            innerGlow: '#8fda53',
            rim: '#1f4a1a',
            shadow: '#0c1709',
            caustic: '#e8fbd8'
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
    const baseGradientId = $derived(`glass-bead-base-${tone}-${safeIdSuffix}`)
    const topShadeGradientId = $derived(`glass-bead-top-${tone}-${safeIdSuffix}`)
    const lowerGlowGradientId = $derived(`glass-bead-lower-${tone}-${safeIdSuffix}`)
    const glossGradientId = $derived(`glass-bead-gloss-${tone}-${safeIdSuffix}`)
</script>

<svg {width} {height} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" {...svgProps}>
    <defs>
        <radialGradient id={baseGradientId} cx="42%" cy="30%" r="72%">
            <stop offset="0%" stop-color={colors.baseLight} />
            <stop offset="35%" stop-color={colors.baseMid} />
            <stop offset="78%" stop-color={colors.baseDark} />
            <stop offset="100%" stop-color={colors.baseDeep} />
        </radialGradient>
        <radialGradient id={topShadeGradientId} cx="52%" cy="18%" r="70%">
            <stop offset="0%" stop-color={colors.topShade} stop-opacity="0.86" />
            <stop offset="60%" stop-color={colors.topShade} stop-opacity="0.52" />
            <stop offset="100%" stop-color={colors.topShade} stop-opacity="0" />
        </radialGradient>
        <radialGradient id={lowerGlowGradientId} cx="52%" cy="84%" r="56%">
            <stop offset="0%" stop-color={colors.innerGlow} stop-opacity="0.95" />
            <stop offset="72%" stop-color={colors.innerGlow} stop-opacity="0.2" />
            <stop offset="100%" stop-color={colors.innerGlow} stop-opacity="0" />
        </radialGradient>
        <linearGradient id={glossGradientId} x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.75" />
            <stop offset="55%" stop-color="#ffffff" stop-opacity="0.06" />
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
    </defs>

    <ellipse cx="50" cy="79.5" rx="28" ry="8.8" fill={colors.shadow} opacity="0.2" />
    <ellipse cx="50" cy="50.5" rx="33.2" ry="33.2" fill={`url(#${baseGradientId})`} stroke={colors.rim} stroke-width="2.2" />
    <ellipse cx="50" cy="44.6" rx="28.8" ry="18.8" fill={`url(#${topShadeGradientId})`} />
    <ellipse cx="50" cy="66" rx="19.4" ry="8.9" fill={`url(#${lowerGlowGradientId})`} opacity="0.92" />
    <ellipse cx="50" cy="70.8" rx="9.8" ry="4.2" fill={colors.caustic} opacity="0.42" />

    <path d="M30.5 33.8c7.6-4.5 23.2-5.1 37.4-.4" fill="none" stroke={`url(#${glossGradientId})`} stroke-width="5.6" stroke-linecap="round" opacity="0.72" />
    <ellipse cx="58.4" cy="34.6" rx="9.6" ry="3.8" fill="#fff9ed" opacity="0.4" />
    <path d="M26.8 55.2c2.5 8.8 10.8 16.1 20.1 19.3" fill="none" stroke={colors.caustic} stroke-width="2.1" stroke-linecap="round" opacity="0.22" />
</svg>
