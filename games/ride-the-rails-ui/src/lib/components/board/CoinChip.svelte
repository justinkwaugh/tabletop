<script lang="ts">
    let { amount, gold = false }: { amount: number; gold?: boolean } = $props()

    const RADIUS = 15
    const FONT_SIZE = 13
</script>

<!-- Art plan, Coin chip: a coin with its amount, centred on the origin; the Transcontinental's is gold. -->
<g aria-hidden="true">
    <circle cx="1.5" cy="2" r={RADIUS} fill="var(--rtr-halo)" fill-opacity="0.35"></circle>
    <circle
        r={RADIUS}
        fill={gold ? 'var(--rtr-gold)' : 'var(--rtr-coin)'}
        stroke="var(--rtr-halo)"
        stroke-width="2"
    ></circle>
    <circle
        r={RADIUS - 4}
        fill="none"
        stroke={gold ? 'var(--rtr-ink-light)' : 'var(--rtr-halo)'}
        stroke-opacity="0.4"
        stroke-width="1.2"
    ></circle>
    <text
        y={FONT_SIZE * 0.35}
        text-anchor="middle"
        font-size={FONT_SIZE}
        font-weight="800"
        fill={gold ? 'var(--rtr-ink-light)' : 'var(--rtr-halo)'}>${amount}</text
    >
</g>
