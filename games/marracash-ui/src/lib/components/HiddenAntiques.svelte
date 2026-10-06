<script lang="ts">
    import { AntiquesPerPlayer } from '@tabletop/marracash'
    import { PanelPalette } from '$lib/utils/playerPanel.js'

    const FanStepDegrees = 7
    const FanDropPerStep = 1.5
    const Star =
        'M13 11 L15 15.5 L19.5 15.5 L16 18.5 L17.5 23 L13 20.2 L8.5 23 L10 18.5 L6.5 15.5 L11 15.5 Z'

    const middle = (AntiquesPerPlayer - 1) / 2
</script>

<div class="flex items-center gap-2.5 pb-0.5 pl-3">
    <div class="flex">
        {#each { length: AntiquesPerPlayer } as _, index (index)}
            <svg
                class="card-back"
                width="26"
                height="36"
                viewBox="0 0 26 36"
                aria-hidden="true"
                style:transform="rotate({(index - middle) * FanStepDegrees}deg) translateY({Math.abs(
                    index - middle
                ) * FanDropPerStep}px)"
            >
                <rect
                    x="0.75"
                    y="0.75"
                    width="24.5"
                    height="34.5"
                    rx="3"
                    fill={PanelPalette.cardBack}
                    stroke={PanelPalette.brass}
                    stroke-width="1.5"
                ></rect>
                <rect
                    x="3.5"
                    y="3.5"
                    width="19"
                    height="29"
                    rx="1.5"
                    fill="none"
                    stroke={PanelPalette.brass}
                    stroke-opacity="0.5"
                    stroke-width="0.8"
                ></rect>
                <path d={Star} fill={PanelPalette.brass}></path>
            </svg>
        {/each}
    </div>
    <span class="text-xs italic" style:color={PanelPalette.cream}
        >{AntiquesPerPlayer} hidden antiques</span
    >
</div>

<style>
    .card-back {
        transform-origin: 50% 100%;
        filter: drop-shadow(1px 1px 1px rgb(0 0 0 / 0.45));
    }
    .card-back + .card-back {
        margin-left: -14px;
    }
</style>
