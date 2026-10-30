<script lang="ts">
    import type { BoundingBox } from '@tabletop/common'

    let { remaining, box }: { remaining: number; box: BoundingBox } = $props()
</script>

<!-- R-1.3, R-5: the bag shows how many pieces are left, never which. -->
<g transform="translate({box.x} {box.y})" data-bag={remaining}>
    <path
        d="M52 22 C34 0 106 0 88 22 L104 40 C150 82 148 132 70 132 C-8 132 -10 82 36 40 Z"
        fill="var(--pp-paper)"
        stroke="var(--pp-halo)"
        stroke-width="6"
    ></path>
    <path d="M40 34 H100" stroke="var(--pp-paper-line)" stroke-width="7"></path>
    <text x="70" y="90" class="pp-board-figure" font-size="50" fill="var(--pp-ink)"
        >{remaining}</text
    >
    <text
        x="70"
        y="156"
        class="pp-board-figure pp-board-caption"
        font-size="25"
        fill="var(--pp-text)">IN THE BAG</text
    >
</g>
