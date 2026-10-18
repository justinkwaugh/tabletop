<script lang="ts">
    import {
        ARROW_CASING,
        ARROW_HEAD_HALF_WIDTH,
        ARROW_HEAD_LENGTH,
        ARROW_SHAFT_WIDTH,
        type DrawnArrow
    } from '$lib/utils/wayArrow.js'

    /** `color` is the ink of the arrow where it is not the plain dark one: an army's colour for a trail of its move. */
    let { arrow, color }: { arrow: DrawnArrow; color?: string } = $props()

    const ARROW_HEAD = `M0 0 L${-ARROW_HEAD_LENGTH} ${-ARROW_HEAD_HALF_WIDTH} L${-ARROW_HEAD_LENGTH} ${ARROW_HEAD_HALF_WIDTH} Z`

    const head = $derived(
        `translate(${arrow.tip.x} ${arrow.tip.y}) rotate(${arrow.angle}) scale(${arrow.scale})`
    )
    const shaft = $derived(arrow.shaft.map((point) => `${point.x},${point.y}`).join(' '))
</script>

<g class="nt-way-arrow" stroke-width={ARROW_SHAFT_WIDTH * arrow.scale} style:--nt-way-ink={color}>
    <polyline
        points={shaft}
        class="nt-way-arrow-casing"
        stroke-width={(ARROW_SHAFT_WIDTH + ARROW_CASING * 2) * arrow.scale}
    ></polyline>
    <path
        d={ARROW_HEAD}
        transform={head}
        class="nt-way-arrow-casing"
        stroke-width={ARROW_CASING * 2}
    ></path>
    <polyline points={shaft}></polyline>
    <path d={ARROW_HEAD} transform={head} stroke="none"></path>
</g>

<style>
    .nt-way-arrow {
        fill: none;
        stroke: var(--nt-way-ink, #2b2620);
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .nt-way-arrow path {
        fill: var(--nt-way-ink, #2b2620);
    }

    .nt-way-arrow .nt-way-arrow-casing {
        fill: #f1ecdc;
        stroke: #f1ecdc;
    }

    .nt-way-arrow polyline.nt-way-arrow-casing {
        fill: none;
    }
</style>
