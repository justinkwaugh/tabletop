<script lang="ts">
    // PROTOTYPE, throwaway: oracle styles side by side. Open /prototype-oracle.
    import { localHexPoints } from '$lib/utils/boardGeometry.js'
    import OracleArt from '$lib/components/board/OracleArt.svelte'
    import OracleVariantArt from '$lib/components/board/prototype-oracle/OracleVariantArt.svelte'
    import {
        ORACLE_VARIANT_NAMES,
        type OracleVariant
    } from '$lib/components/board/prototype-oracle/oracleVariant.svelte.js'
    import '../../app.css'

    const VARIANTS: OracleVariant[] = ['G', 'I']
    const STATES: { label: string; angle?: number; color?: string }[] = [
        { label: 'Unfavoured' },
        { label: 'Red → E', angle: 0, color: '#c8461f' },
        { label: 'Blue → SW', angle: 120, color: '#4a94d0' },
        { label: 'Yellow → NW', angle: -120, color: '#f5e04a' },
        { label: 'Gray → NE', angle: -60, color: '#686d73' }
    ]
    const TINTS = ['#d6b564', '#d1af5d', '#d7b96c', '#cbac5a', '#d3b360']
    const hex = localHexPoints()
    const CELL = 120
</script>

<div class="page">
    <svg viewBox="-90 -70 {150 + STATES.length * CELL} {VARIANTS.length * CELL + 60}">
        <defs>
            <radialGradient id="mg-land-shade">
                <stop offset="0" stop-color="#fff8e0" stop-opacity="0.16"></stop>
                <stop offset="0.7" stop-color="#fff8e0" stop-opacity="0"></stop>
                <stop offset="1" stop-color="#6b4a1c" stop-opacity="0.16"></stop>
            </radialGradient>
            <filter id="mg-tile-shadow" x="-10%" y="-10%" width="125%" height="130%">
                <feDropShadow
                    dx="1.5"
                    dy="2.5"
                    stdDeviation="1.6"
                    flood-color="#3a2410"
                    flood-opacity="0.45"
                ></feDropShadow>
            </filter>
        </defs>
        {#each STATES as state, c (state.label)}
            <text x={60 + c * CELL} y="-50" text-anchor="middle" font-size="13" fill="#4a2c12"
                >{state.label}</text
            >
        {/each}
        {#each VARIANTS as variant, r (variant)}
            <text x="-85" y={r * CELL + 5} font-size="14" fill="#4a2c12" font-weight="700"
                >{variant} · {ORACLE_VARIANT_NAMES[variant]}</text
            >
            {#each STATES as state, c (state.label)}
                <g transform="translate({60 + c * CELL} {r * CELL})">
                    <polygon points={hex} fill={TINTS[(r + c) % TINTS.length]}></polygon>
                    <polygon points={hex} fill="url(#mg-land-shade)"></polygon>
                    <polygon
                        points={hex}
                        fill="none"
                        stroke="rgba(255, 250, 235, 0.55)"
                        stroke-width="1.2"
                    ></polygon>
                    {#if variant === 'A'}
                        <OracleArt angle={state.angle} attentionColor={state.color} />
                    {:else}
                        <OracleVariantArt
                            {variant}
                            angle={state.angle}
                            attentionColor={state.color}
                        />
                    {/if}
                </g>
            {/each}
        {/each}
    </svg>
</div>

<style>
    .page {
        min-height: 100vh;
        background: #f3ecdc;
        padding: 16px;
    }
    svg {
        width: 100%;
        max-width: 1100px;
    }
</style>
