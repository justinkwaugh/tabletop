<script lang="ts">
    import type { BoundingBox } from '@tabletop/common'

    let {
        box,
        label,
        tone = 'plain',
        onselect
    }: {
        box: BoundingBox
        label: string
        tone?: 'plain' | 'attack'
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
    x={box.x + 5}
    y={box.y + 5}
    width={box.width - 10}
    height={box.height - 10}
    rx="10"
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
