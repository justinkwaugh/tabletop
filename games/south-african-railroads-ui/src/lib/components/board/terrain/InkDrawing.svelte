<!-- One small ink drawing for the paper, in the manner of Texas Special's: about 70 units across at
     scale 1, centred on its point, in the same grey ink. -->
<script lang="ts">
    import type { InkDrawing } from '$lib/utils/boardLayout.js'

    let { drawing }: { drawing: InkDrawing } = $props()

    const COMPASS_POINTS = Array.from({ length: 8 }, (_, index) => {
        const angle = (index * Math.PI) / 4
        const length = index % 2 === 0 ? 46 : 20
        const half = index % 2 === 0 ? 7.5 : 3.6
        const tip = { x: Math.sin(angle) * length, y: -Math.cos(angle) * length }
        const left = { x: -Math.cos(angle) * half, y: -Math.sin(angle) * half }
        return {
            dark: `M 0 0 L ${left.x.toFixed(1)} ${left.y.toFixed(1)} L ${tip.x.toFixed(1)} ${tip.y.toFixed(1)} Z`,
            light: `M 0 0 L ${(-left.x).toFixed(1)} ${(-left.y).toFixed(1)} L ${tip.x.toFixed(1)} ${tip.y.toFixed(1)} Z`
        }
    })
</script>

<g
    transform="translate({drawing.x} {drawing.y}) scale({drawing.scale ?? 1})"
    class="ink"
    stroke-linecap="round"
    stroke-linejoin="round"
>
    {#if drawing.kind === 'acacia'}
        <!-- A flat-topped thorn tree on the veld -->
        <path
            d="M -36 -12 C -32 -24 -16 -27 0 -25 C 16 -27 32 -24 36 -12 C 24 -6 -24 -6 -36 -12 Z"
            class="shade"
        ></path>
        <path d="M 0 28 L 1 6 L -12 -9 M 1 6 L 12 -9 M -2 16 L -18 -8 M 1 10 L 22 -8"></path>
        <path d="M -24 28 L 24 28"></path>
    {:else if drawing.kind === 'pines'}
        <!-- Three pines -->
        {#each [{ x: -14, s: 1 }, { x: 13, s: 0.82 }, { x: 0, s: 0.66 }] as pine (pine.x)}
            <g transform="translate({pine.x} {8 - pine.s * 4}) scale({pine.s})">
                <path
                    d="M 0 -30 L 9 -16 L 4 -16 L 13 -3 L 6 -3 L 16 10 L -16 10 L -6 -3 L -13 -3 L -4 -16 L -9 -16 Z"
                    class="shade"
                ></path>
                <path d="M 0 10 L 0 18" stroke-width="2.4"></path>
            </g>
        {/each}
    {:else if drawing.kind === 'diamond'}
        <!-- A cut diamond, for the diamond fields -->
        <path d="M -24 -8 L -13 -21 L 13 -21 L 24 -8 L 0 24 Z" class="paper"></path>
        <path
            d="M -24 -8 L 24 -8 M -13 -21 L -7 -8 L 0 -21 L 7 -8 L 13 -21 M -7 -8 L 0 24 L 7 -8"
            stroke-width="1.2"
        ></path>
        <path d="M 30 -26 L 30 -16 M 25 -21 L 35 -21 M -32 10 L -32 16 M -35 13 L -29 13"></path>
    {:else if drawing.kind === 'headframe'}
        <!-- A mine headframe over its shaft -->
        <path d="M -14 32 L -3 -22 M 14 32 L 3 -22 M -3 -22 L 3 -22"></path>
        <path d="M -11 18 L 11 18 M -8 4 L 8 4 M -5 -10 L 5 -10 M -11 18 L 8 4 M 11 18 L -8 4"
        ></path>
        <path d="M 3 -22 L 30 32"></path>
        <circle cx="0" cy="-27" r="7" class="paper"></circle>
        <path d="M -5 -27 L 5 -27 M 0 -32 L 0 -22" stroke-width="1"></path>
        <path d="M -34 32 L -34 16 L -20 16 L -20 32" class="shade"></path>
        <path d="M -40 32 L 38 32"></path>
    {:else if drawing.kind === 'mountains'}
        <!-- A range of peaks, hatched on their shaded sides -->
        <path d="M -46 22 L -26 -8 L -16 6 L 0 -24 L 15 -1 L 23 -11 L 46 22" class="paper"></path>
        <path
            d="M 0 -24 L 4 -6 L -2 4 M -26 -8 L -22 4 M 23 -11 L 26 4 M 6 -14 L 12 -2 M 30 -2 L 33 10 M 9 -9 L 14 6"
            stroke-width="1.1"
        ></path>
    {:else if drawing.kind === 'ship'}
        <!-- A three-masted sailing ship -->
        <path d="M -30 10 L 30 10 L 22 20 L -24 20 Z" class="shade"></path>
        <path d="M -14 10 L -14 -26 M 2 10 L 2 -34 M 18 10 L 18 -22"></path>
        <path
            d="M -24 4 Q -14 -2 -4 4 L -4 -12 Q -14 -16 -24 -12 Z M -8 6 Q 2 0 12 6 L 12 -16 Q 2 -20 -8 -16 Z M 10 4 Q 18 0 26 4 L 26 -8 Q 18 -11 10 -8 Z"
            class="paper"
            stroke-width="1.2"
        ></path>
        <path d="M -38 27 q 6 -5 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0" class="water"></path>
    {:else if drawing.kind === 'compass'}
        <!-- A compass rose -->
        <circle r="38" fill="none" stroke-width="1"></circle>
        <circle r="34" fill="none" stroke-width="0.6" stroke-dasharray="2 4"></circle>
        {#each COMPASS_POINTS as point (point.dark)}
            <path d={point.dark} class="solid"></path>
            <path d={point.light} class="paper" stroke-width="1"></path>
        {/each}
        <text y="-53" class="north">N</text>
    {:else if drawing.kind === 'steel-mill'}
        <!-- A steel mill: sawtooth sheds and smoking stacks -->
        <path d="M -36 30 L -36 4 L -24 -6 L -24 4 L -12 -6 L -12 4 L 0 -6 L 0 30 Z" class="shade"
        ></path>
        <path d="M 6 30 L 6 -24 L 12 -24 L 12 30 M 18 30 L 18 -16 L 23 -16 L 23 30"></path>
        <path
            d="M 9 -28 c -6 -5 6 -9 0 -15 c -5 -5 8 -8 3 -14 M 20 -20 c -5 -4 5 -8 0 -12"
            stroke-width="1.2"
        ></path>
        <path d="M -40 30 L 32 30"></path>
    {:else if drawing.kind === 'liberty-bell'}
        <!-- The Liberty Bell and its crack -->
        <path d="M -16 -24 L 16 -24 M -10 -30 L 10 -30 M 0 -24 L 0 -19"></path>
        <path
            d="M -15 14 C -15 -2 -12 -18 0 -19 C 12 -18 15 -2 15 14 L 21 20 L -21 20 Z"
            class="paper"
        ></path>
        <path d="M -21 20 L 21 20 M -16 12 L 16 12" stroke-width="1.1"></path>
        <path d="M 3 20 L 0 12 L 4 6 L 1 -2" stroke-width="1.2"></path>
        <circle cx="0" cy="26" r="3.5" class="solid"></circle>
    {:else if drawing.kind === 'lighthouse'}
        <!-- A lighthouse on its rocks, its beam out to sea -->
        <path d="M -9 26 L -6 -14 L 6 -14 L 9 26 Z" class="paper"></path>
        <path d="M -8 12 L 8 12 M -7 -1 L 7 -1" stroke-width="3"></path>
        <path d="M -8 -14 L 8 -14 L 8 -22 L -8 -22 Z M -9 -22 L 0 -30 L 9 -22" class="shade"></path>
        <path
            d="M 12 -22 L 36 -30 M 12 -16 L 36 -12 M -12 -22 L -34 -30 M -12 -16 L -34 -12"
            stroke-width="1"
        ></path>
        <path d="M -24 26 Q -16 18 -6 26 M 6 26 Q 16 16 26 26 M -30 32 L 30 32"></path>
    {:else if drawing.kind === 'wheat'}
        <!-- A sheaf of wheat for the prairie farms -->
        {#each [-14, -7, 0, 7, 14] as lean (lean)}
            <g transform="rotate({lean})">
                <path d="M 0 30 L 0 -14" stroke-width="1.2"></path>
                <path
                    d="M 0 -14 l -4 -4 M 0 -14 l 4 -4 M 0 -20 l -4 -4 M 0 -20 l 4 -4 M 0 -26 l -3 -4 M 0 -26 l 3 -4 M 0 -26 l 0 -6"
                    stroke-width="1.2"
                ></path>
            </g>
        {/each}
        <path d="M -8 10 Q 0 16 8 10" stroke-width="2.4"></path>
    {/if}
</g>

<style>
    .ink {
        fill: none;
        stroke: #4e5b66;
        stroke-width: 1.8;
    }

    .shade {
        fill: #4e5b66;
        fill-opacity: 0.2;
    }

    .paper {
        fill: #fbf6e7;
    }

    .solid {
        fill: #4e5b66;
        stroke: none;
    }

    .water {
        stroke: #7f9bb0;
        stroke-width: 1.4;
    }

    .north {
        fill: #4e5b66;
        stroke: none;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 15px;
        text-anchor: middle;
    }
</style>
