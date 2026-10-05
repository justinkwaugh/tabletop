<script lang="ts">
    import type { ShipState } from '@tabletop/stellar-horizons-2'
    import { FLAGLESS_SHIP_ART, SHIP_ART } from '$lib/art/manifest.js'

    let { ship, size }: { ship: ShipState; size: number } = $props()
    const clipId = $props.id()
    const badge = $derived(size * 0.12)
    const corner = $derived(size * 0.07)
    const damaged = $derived(ship.damage > 0)
    const art = $derived((damaged ? FLAGLESS_SHIP_ART : SHIP_ART)[ship.shipId])
    const damageWidth = $derived(size * 0.3)
    const damageHeight = $derived(size * 0.26)
    const damageBadge = $derived.by(() => {
        const inset = 1.5
        const outer = corner - inset
        const inner = size * 0.04
        const right = inset + damageWidth
        const bottom = inset + damageHeight
        return [
            `M ${inset} ${inset + outer}`,
            `A ${outer} ${outer} 0 0 1 ${inset + outer} ${inset}`,
            `H ${right}`,
            `V ${bottom - inner}`,
            `A ${inner} ${inner} 0 0 1 ${right - inner} ${bottom}`,
            `H ${inset}`,
            'Z'
        ].join(' ')
    })
</script>

<clipPath id={clipId}>
    <rect width={size} height={size} rx={corner}></rect>
</clipPath>
{#if damaged}
    <filter id="{clipId}-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation={size * 0.06}></feGaussianBlur>
    </filter>
    <rect width={size} height={size} rx={corner} class="damaged-glow" filter="url(#{clipId}-glow)"
    ></rect>
{/if}
<image href={art} width={size} height={size} clip-path="url(#{clipId})"></image>
{#if damaged}
    <rect
        x="1.5"
        y="1.5"
        width={size - 3}
        height={size - 3}
        rx={corner - 1.5}
        class="damaged-border"
    ></rect>
    <path d={damageBadge} class="damage"></path>
    <text
        x={1.5 + damageWidth / 2}
        y={1.5 + damageHeight * 0.72}
        text-anchor="middle"
        font-size={damageHeight * 0.62}
        class="badge-text">-{ship.damage}</text
    >
{/if}
{#if ship.settlements > 0}
    <circle cx={badge * 1.1} cy={size / 2} r={badge} class="cargo"></circle>
    <text
        x={badge * 1.1}
        y={size / 2 + badge * 0.45}
        text-anchor="middle"
        font-size={badge * 1.25}
        class="cargo-text">{ship.settlements}</text
    >
{/if}

<style>
    .cargo-text {
        font-weight: 900;
        fill: #111111;
    }

    .damaged-glow {
        fill: #ff3b30;
    }

    .damaged-border {
        fill: none;
        stroke: #d32f2f;
        stroke-width: 3px;
    }

    .damage {
        fill: #d32f2f;
    }

    .badge-text {
        font-weight: 900;
        fill: #ffffff;
    }

    .cargo {
        fill: #f5f1e6;
        stroke: #1d1a14;
        stroke-width: 1.5px;
    }
</style>
