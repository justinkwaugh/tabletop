<script lang="ts">
    let { count, x = 0, y = 0 }: { count: string | number; x?: number; y?: number } = $props()

    let width = $derived(10 + `${count}`.length * 9)
</script>

<g transform="translate({x} {y})" role="img" aria-label="count {count}">
    <rect
        x={-width / 2}
        y="-10"
        {width}
        height="20"
        rx="10"
        fill="var(--feudum-surface-raised)"
        stroke="var(--feudum-halo)"
        stroke-width="2"
    ></rect>
    <text y="5" text-anchor="middle" font-size="14" font-weight="700" fill="var(--feudum-text)"
        >{count}</text
    >
</g>
