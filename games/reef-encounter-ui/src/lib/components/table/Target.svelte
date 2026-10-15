<script lang="ts">
    import type { BoundingBox } from '@tabletop/common'

    let {
        box,
        label,
        tone = 'plain',
        inset = 5,
        radius = 10,
        onselect
    }: {
        box: BoundingBox
        // How far inside the box the ring's line runs, and how round its corners are; a ring
        // over a printed frame lies along that frame instead.
        inset?: number
        radius?: number
        label: string
        tone?: 'plain' | 'attack' | 'piece' | 'eat' | 'chosen'
        onselect: () => void
    } = $props()

    function onkeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onselect()
        }
    }
</script>

<rect
    class="target {tone}"
    x={box.x + inset}
    y={box.y + inset}
    width={box.width - 2 * inset}
    height={box.height - 2 * inset}
    rx={radius}
    role="button"
    tabindex="0"
    aria-label={label}
    onclick={onselect}
    {onkeydown}
></rect>

<style>
    .target {
        cursor: pointer;
        fill: rgb(255 255 255 / 0.18);
        stroke: #ffffff;
        stroke-width: 7;
    }

    .target.attack {
        fill: rgb(239 143 46 / 0.22);
        stroke: #ef8f2e;
        stroke-dasharray: 18 9;
    }

    .target.piece {
        fill: rgb(255 255 255 / 0);
        stroke: rgb(255 255 255 / 0.9);
        stroke-width: 5;
        stroke-dasharray: 10 8;
    }

    .target.chosen {
        fill: rgb(239 143 46 / 0);
        stroke: #ef8f2e;
        stroke-width: 8;
    }

    .target.chosen:hover,
    .target.chosen:focus-visible {
        fill: rgb(239 143 46 / 0.3);
    }

    .target.eat {
        fill: rgb(226 70 44 / 0.2);
        stroke: #ff8a6b;
    }

    .target.eat:hover,
    .target.eat:focus-visible {
        fill: rgb(226 70 44 / 0.42);
    }

    .target:hover,
    .target:focus-visible {
        fill: rgb(255 255 255 / 0.4);
        outline: none;
    }

    .target.attack:hover,
    .target.attack:focus-visible {
        fill: rgb(239 143 46 / 0.45);
    }
</style>
