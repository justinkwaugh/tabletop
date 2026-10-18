<script lang="ts">
    // The printed anomaly tile. When the difficulty that applies is given, it is drawn over the
    // printed one, inside the same red triangle or blue disc. In a scenario that ignores
    // anomaly rewards, the printed reward is covered. A resolved tile that stays in its system is
    // shown turned over, its back giving the bases there their effect.
    import {
        AnomalyChallenge,
        anomalyDefinition,
        usesAnomalyRewards
    } from '@tabletop/stellar-horizons-2'
    import {
        ANOMALY_ART,
        ANOMALY_ART_SIZE,
        ANOMALY_BACK_ART,
        ANOMALY_BADGE
    } from '$lib/art/manifest.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const DISC_INSET = 1.5
    const TRIANGLE_OUTSET = 1
    // The no-exploration and no-bases icons beside the badge reach a little lower than it;
    // the printed reward is everything on the tile below them.
    const ICON_ROW_BELOW_BADGE = 7
    // The tile art is cut to a hexagon this far inside its image.
    const ART_INSET = 3

    let {
        anomalyId,
        difficulty,
        width,
        x = 0,
        y = 0,
        turned = false
    }: {
        anomalyId: string
        difficulty?: number
        width: number
        x?: number
        y?: number
        turned?: boolean
    } = $props()

    const gameSession = getGameSession()
    const anomaly = $derived(anomalyDefinition(anomalyId))
    const badge = $derived(ANOMALY_BADGE[anomalyId])
    const rewardCover = $derived(
        turned || usesAnomalyRewards(gameSession.gameState)
            ? undefined
            : lowerHexagon(badge.y + badge.height / 2 + ICON_ROW_BELOW_BADGE)
    )

    // The part of the tile's hexagon below a line in its lower half.
    function lowerHexagon(top: number): string {
        const { width: artWidth, height: artHeight } = ANOMALY_ART_SIZE
        const middle = artHeight / 2
        const bottom = artHeight - ART_INSET
        const quarter = (artWidth - ART_INSET * 2) / 4
        const left = ART_INSET + ((top - middle) / (bottom - middle)) * quarter
        return [
            [left, top],
            [artWidth - left, top],
            [artWidth - ART_INSET - quarter, bottom],
            [ART_INSET + quarter, bottom]
        ]
            .map(([px, py]) => `${px},${py}`)
            .join(' ')
    }
    const science = $derived(anomaly.challenge === AnomalyChallenge.Science)
    const height = $derived((width * ANOMALY_ART_SIZE.height) / ANOMALY_ART_SIZE.width)
    const triangle = $derived(
        [
            [badge.x, badge.y - badge.height / 2 - TRIANGLE_OUTSET],
            [badge.x + badge.width / 2 + TRIANGLE_OUTSET, badge.y + badge.height / 2],
            [badge.x - badge.width / 2 - TRIANGLE_OUTSET, badge.y + badge.height / 2]
        ]
            .map(([px, py]) => `${px},${py}`)
            .join(' ')
    )
</script>

<svg
    {x}
    {y}
    {width}
    {height}
    viewBox="0 0 {ANOMALY_ART_SIZE.width} {ANOMALY_ART_SIZE.height}"
    role="img"
    aria-label={turned
        ? `${anomaly.name}, resolved`
        : difficulty === undefined
          ? anomaly.name
          : `${anomaly.name}, difficulty ${difficulty}`}
>
    <image
        href={turned ? ANOMALY_BACK_ART[anomalyId] : ANOMALY_ART[anomalyId]}
        width={ANOMALY_ART_SIZE.width}
        height={ANOMALY_ART_SIZE.height}
    ></image>
    {#if rewardCover}
        <polygon class="cover" points={rewardCover}></polygon>
    {/if}
    {#if difficulty !== undefined && !turned}
        {#if science}
            <circle class="science" cx={badge.x} cy={badge.y} r={badge.width / 2 - DISC_INSET}
            ></circle>
            <text
                class="value"
                class:long={difficulty > 9}
                x={badge.x}
                y={badge.y}
                dy="0.36em"
                text-anchor="middle">{difficulty}</text
            >
        {:else}
            <polygon class="combat" points={triangle}></polygon>
            <text
                class="value in-triangle"
                class:long={difficulty > 9}
                x={badge.x}
                y={badge.y + badge.height * 0.2}
                dy="0.36em"
                text-anchor="middle">{difficulty}</text
            >
        {/if}
    {/if}
</svg>

<style>
    svg {
        display: block;
        flex-shrink: 0;
    }

    .cover {
        fill: #050708;
    }

    .science {
        fill: #007db7;
    }

    .combat {
        fill: #c71c22;
    }

    .value {
        font-family: 'Hind Digits', sans-serif;
        font-weight: 700;
        font-size: 30px;
        fill: #d5d2c6;
    }

    .value.long {
        font-size: 27px;
    }

    .value.in-triangle {
        font-size: 27px;
    }

    .value.in-triangle.long {
        font-size: 21px;
    }
</style>
