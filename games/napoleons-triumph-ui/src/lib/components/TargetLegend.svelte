<script lang="ts">
    import { TargetMark } from '$lib/model/targets.js'
    import { ATTACK_ARROW_PATH } from '$lib/utils/attackMarker.js'

    let { marks }: { marks: TargetMark[] } = $props()

    const MEANINGS: Record<TargetMark, string> = {
        [TargetMark.Move]: 'move',
        [TargetMark.RoadMarch]: 'march by road',
        [TargetMark.Way]: 'choose which way',
        [TargetMark.Approach]: 'block an approach',
        [TargetMark.Threat]: 'threaten an attack',
        [TargetMark.ClosedReserve]: 'closed to other units by a road march'
    }
</script>

<span class="nt-legend">
    {#each marks as mark (mark)}
        <span class="nt-legend-entry">
            <svg viewBox="0 0 26 16" aria-hidden="true">
                <rect width="26" height="16" rx="2" class="nt-legend-map"></rect>
                {#if mark === TargetMark.Threat}
                    <path
                        d={ATTACK_ARROW_PATH}
                        transform="translate(12.4 8) scale(0.27)"
                        class="nt-legend-arrow"
                    ></path>
                {:else if mark === TargetMark.ClosedReserve}
                    <rect x="3" y="2.5" width="20" height="11" class="nt-legend-closed"></rect>
                    <path
                        d="M5 13.5 L16 2.5 M11 13.5 L22 2.5 M3 9.5 L10 2.5 M17 13.5 L23 7.5"
                        class="nt-legend-closed-line"
                    ></path>
                {:else if mark === TargetMark.Approach}
                    <rect x="3" y="5" width="20" height="6" rx="1" class="nt-legend-approach"
                    ></rect>
                {:else}
                    <rect
                        x="3"
                        y="2.5"
                        width="20"
                        height="11"
                        class="nt-legend-locale"
                        class:nt-legend-road={mark === TargetMark.RoadMarch}
                        class:nt-legend-way={mark === TargetMark.Way}
                    ></rect>
                {/if}
            </svg>
            {MEANINGS[mark]}
        </span>
    {/each}
</span>

<style>
    .nt-legend {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 3px 14px;
    }

    .nt-legend-entry {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
    }

    svg {
        display: block;
        flex: none;
        width: 26px;
        height: 16px;
    }

    .nt-legend-map {
        fill: #dfe8de;
    }

    .nt-legend-arrow {
        fill: #2b2620;
        stroke: #f1ecdc;
        stroke-width: 5;
        stroke-linejoin: round;
        paint-order: stroke;
    }

    .nt-legend-locale {
        fill: var(--nt-move-fill);
        stroke: var(--nt-move-line);
        stroke-width: 1.4;
        stroke-dasharray: 4 3;
    }

    .nt-legend-locale.nt-legend-road {
        fill: var(--nt-road-fill);
        stroke: var(--nt-road-line);
    }

    .nt-legend-locale.nt-legend-way {
        fill: var(--nt-way-fill);
        stroke: var(--nt-way-line);
        stroke-dasharray: none;
    }

    .nt-legend-closed {
        fill: var(--nt-closed-fill);
    }

    .nt-legend-closed-line {
        fill: none;
        stroke: var(--nt-closed-line);
        stroke-width: 0.9;
    }

    .nt-legend-approach {
        fill: var(--nt-approach-fill);
        stroke: var(--nt-move-line);
        stroke-width: 1.2;
    }
</style>
