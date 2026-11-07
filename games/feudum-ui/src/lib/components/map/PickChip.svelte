<script lang="ts">
    import type { BoardChip } from '$lib/model/boardOffer.js'

    /**
     * Contract, Pick conventions: a short note on a target. Rose carries a cost or a threat, amber
     * what is yours to take; each over the dark halo, so no ground stands in for it.
     */
    let { chip, y = 0 }: { chip: BoardChip; y?: number } = $props()

    const Height = 34
    const CharWidth = 13.5
    let width = $derived(20 + chip.label.length * CharWidth)
    let rose = $derived(chip.tone === 'rose')
</script>

<g transform="translate(0 {y})" data-chip={chip.tone}>
    <rect
        x={-width / 2}
        y={-Height / 2}
        {width}
        height={Height}
        rx={Height / 2}
        fill={rose ? 'var(--feudum-danger-soft)' : 'var(--feudum-primary)'}
        stroke="var(--feudum-halo)"
        stroke-width="3"
    ></rect>
    <text
        y="8"
        text-anchor="middle"
        font-size="23"
        font-weight="700"
        fill={rose ? 'var(--feudum-danger)' : 'var(--feudum-accent)'}
        style:font-family="var(--feudum-font-text)">{chip.label}</text
    >
</g>
