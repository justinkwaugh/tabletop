<script lang="ts">
    import { fade } from 'svelte/transition'
    import type { QueueRunner, Segment } from '$lib/utils/boardGeometry.js'
    import { registerRunnerPart, type QueueAnimator } from '$lib/animators/queueAnimator.js'
    import { TableHeight, TableWidth } from '$lib/utils/boardGeometry.js'
    import { centredBaseline, ElMessiriCentralShift } from '$lib/utils/textBaseline.js'

    const Selvedge = '#5a1f16'
    const Field = '#8a2f22'
    const Weave = '#d9a94a'
    const Centre = '#6e2419'
    const Underside = '#4a1a12'
    const Fringe = '#e8d7b5'
    const Ink = '#f6e2b0'
    const LabelSize = 15
    const MaskId = 'marracash-runner-reveal'
    const RevealWidth = 48
    const CutReach = 60
    const BackFadeSeconds = 0.2
    const FringeLength = 6
    const RollFringe = Array.from({ length: 9 }, (_, index) => -16 + index * 4)

    let {
        runner,
        labels,
        animator
    }: { runner: QueueRunner; labels: [string, string]; animator: QueueAnimator } = $props()

    let backKey = $derived(`${runner.labels[1].at.x},${runner.labels[1].at.y}`)
</script>

{#snippet threads(fringe: Segment[])}
    {#each fringe as thread, index (index)}
        <line
            x1={thread.from.x}
            y1={thread.from.y}
            x2={thread.to.x}
            y2={thread.to.y}
            stroke={Fringe}
            stroke-width="1.4"
        ></line>
    {/each}
{/snippet}

{#snippet label(index: number)}
    {@const placed = runner.labels[index]}
    <text
        class="marracash-merchant runner-label"
        x={placed.at.x}
        y={centredBaseline(placed.at.y + 1, LabelSize, ElMessiriCentralShift)}
        font-size={LabelSize}
        fill={Ink}
        text-anchor={placed.anchor}
        transform={placed.rotate
            ? `rotate(${placed.rotate} ${placed.at.x} ${placed.at.y})`
            : undefined}>{labels[index]}</text
    >
{/snippet}

<!-- The runner is drawn whole and revealed through a mask, so rolling it up only shortens the
 mask's stroke. Each new runner shape remounts the mask, so nothing left from a roll carries over. -->
{#key runner.path}
    <mask
        id={MaskId}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width={TableWidth}
        height={TableHeight}
    >
        <path
            use:registerRunnerPart={{ animator, part: 'reveal' }}
            d={runner.path}
            fill="none"
            stroke="#ffffff"
            stroke-width={RevealWidth}
            stroke-linejoin="round"
        ></path>
        <!-- Trims the carpet along the roll's line, so the cut follows the roll round a corner. -->
        <rect
            use:registerRunnerPart={{ animator, part: 'cut' }}
            x="0"
            y={-CutReach}
            width={CutReach}
            height={2 * CutReach}
            fill="#000000"
            display="none"
        ></rect>
    </mask>
{/key}
<g aria-hidden="true" mask="url(#{MaskId})">
    <path d={runner.path} fill="none" stroke={Selvedge} stroke-width="40" stroke-linejoin="round"
    ></path>
    <path d={runner.path} fill="none" stroke={Field} stroke-width="34" stroke-linejoin="round"
    ></path>
    <path
        d={runner.path}
        fill="none"
        stroke={Weave}
        stroke-width="26"
        stroke-dasharray="3 5"
        stroke-linejoin="round"
        opacity="0.35"
    ></path>
    <path d={runner.path} fill="none" stroke={Centre} stroke-width="22" stroke-linejoin="round"
    ></path>
</g>
<g aria-hidden="true">{@render threads(runner.frontFringe)}</g>
{@render label(0)}
<!-- The back fringe appears with the runner it ends; only the label fades in, so an unrolling
 carpet can hand its fringe straight to the new end. -->
{#key runner.path}
    <g use:registerRunnerPart={{ animator, part: 'back' }} aria-hidden="true">
        {@render threads(runner.backFringe)}
    </g>
{/key}
{#key backKey}
    <g
        use:registerRunnerPart={{ animator, part: 'backLabel' }}
        in:fade={{ duration: BackFadeSeconds * 1000 }}
    >
        {@render label(1)}
    </g>
{/key}
<!-- The carpet rolled up at the back end, seen from above, its fringe wound at the core; the
 animator places it, sizes it and lets the fringe show as it unrolls. Remounted with each runner. -->
{#key runner.path}
    <g use:registerRunnerPart={{ animator, part: 'roll' }} opacity="0" aria-hidden="true">
        <g use:registerRunnerPart={{ animator, part: 'rollFringe' }} opacity="0">
            {#each RollFringe as y (y)}
                <line x1="0" y1={y} x2={FringeLength} y2={y} stroke={Fringe} stroke-width="1.4"
                ></line>
            {/each}
        </g>
        <g use:registerRunnerPart={{ animator, part: 'rollBody' }}>
            <rect
                x="0"
                y="-21"
                width="10"
                height="42"
                rx="4"
                fill={Field}
                stroke={Selvedge}
                stroke-width="1.5"
                vector-effect="non-scaling-stroke"
            ></rect>
            <rect x="5" y="-21" width="5" height="42" rx="2.5" fill={Underside} opacity="0.55"
            ></rect>
            <rect x="1.5" y="-20" width="2" height="40" fill={Weave} opacity="0.4"></rect>
        </g>
    </g>
{/key}

<style>
    .runner-label {
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }
</style>
