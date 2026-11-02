<script lang="ts">
    import { townTileImage } from '$lib/images/tileImages.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        TOWN_TILE_ROTATION,
        endTrackerLines,
        endTrackerStatus,
        localHexPoints,
        pointsAttribute
    } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()

    const uid = $props.id()
    const clipId = `pp-end-tracker-bar-${uid}`
    const icon = pointsAttribute(localHexPoints(0.36))
    const redTile = townTileImage('tile.red.dividend')

    // The same reading as the tracker in the strip beside the map, from the displayed state.
    const status = $derived(endTrackerStatus(gameSession.gameState))
    const lines = $derived(endTrackerLines(status))
    const bagRemaining = $derived(gameSession.gameState.bag.remaining)
</script>

<!-- Contract, "Phone layout": the end tracker under the board, where the strip beside the map is
     a pan away. R-6.1, R-6.1-H1: the game ends after a turn once both lines are ticked; R-6.1-H2:
     or once the bag runs out. A tick is a ✓ in a filled ring, never colour alone. -->
<section
    class="bar"
    aria-label="Game ends when both"
    data-end-tracker-bar
    data-red-tiles-uncovered={status.redTilesUncovered}
    data-red-tiles-met={status.redTilesMet}
    data-promontory-taken={status.promontoryTaken}
>
    <div class="card">
        <div class="both">
            <p class="heading" aria-hidden="true">Game ends when both</p>
            {#each lines as line (line.key)}
                <div class="condition" data-end-condition={line.key} data-met={line.met}>
                    <svg
                        class="tick"
                        viewBox="-34 -34 68 68"
                        role="img"
                        aria-label={line.met ? 'met' : 'not met'}
                        data-end-tick={line.met ? 'met' : 'open'}
                    >
                        {#if line.met}
                            <circle r="30" fill="var(--pp-ok)"></circle>
                            <path
                                d="M-14 1 L-4 12 L15 -11"
                                fill="none"
                                stroke="var(--pp-rr-ink)"
                                stroke-width="8"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            ></path>
                        {:else}
                            <circle r="27" fill="none" stroke="var(--pp-ink-sub)" stroke-width="6"
                            ></circle>
                        {/if}
                    </svg>
                    <svg class="icon" viewBox="-40 -40 80 80" aria-hidden="true">
                        {#if line.key === 'red'}
                            <defs>
                                <clipPath id={clipId}>
                                    <polygon points={icon}></polygon>
                                </clipPath>
                            </defs>
                            <g clip-path="url(#{clipId})">
                                <image
                                    href={redTile.src}
                                    x="-46"
                                    y="-46"
                                    width="92"
                                    height="92"
                                    transform="rotate({TOWN_TILE_ROTATION})"
                                ></image>
                            </g>
                        {:else}
                            <polygon
                                points={icon}
                                fill="var(--pp-charcoal)"
                                stroke="var(--pp-ink)"
                                stroke-width="5"
                            ></polygon>
                        {/if}
                    </svg>
                    <span class="line" data-end-line={line.key}>{line.text}</span>
                </div>
            {/each}
        </div>

        <!-- The other way the game ends. -->
        <span class="or" data-end-or>or</span>

        <!-- R-1.3, R-5: the bag shows how many pieces are left, never which. -->
        <div class="bag" data-bag={bagRemaining}>
            <b class="count">{bagRemaining}</b>
            <span class="words"
                ><span>{bagRemaining === 1 ? 'piece left' : 'pieces left'}</span>
                <span>in the bag</span></span
            >
        </div>
    </div>
</section>

<style>
    .bar {
        flex-shrink: 0;
        padding: 3px 8px;
        background: var(--pp-column);
        border-top: 1px solid var(--pp-halo);
    }

    .card {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 3px 10px 4px;
        border-radius: 6px;
        background: var(--pp-paper);
        color: var(--pp-ink);
    }

    .both {
        flex: 1 1 auto;
        min-width: 0;
    }

    .heading {
        margin: 0 0 1px;
        font-family: Oswald, sans-serif;
        font-size: 10px;
        font-weight: 600;
        line-height: 1.2;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--pp-brown);
    }

    .condition {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12.5px;
        line-height: 1.35;
        white-space: nowrap;
    }

    .tick,
    .icon {
        flex: none;
        width: 15px;
        height: 15px;
    }

    .or {
        flex: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        font-family: 'Libre Caslon Text', serif;
        font-style: italic;
        font-size: 13px;
        color: var(--pp-ink-sub);
    }

    .or::before,
    .or::after {
        content: '';
        width: 1px;
        height: 10px;
        background: color-mix(in srgb, var(--pp-brown) 60%, transparent);
    }

    .bag {
        flex: none;
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .count {
        font-family: Oswald, sans-serif;
        font-size: 26px;
        font-weight: 500;
        line-height: 1;
    }

    .words {
        display: flex;
        flex-direction: column;
        font-family: 'Libre Caslon Text', serif;
        font-style: italic;
        font-size: 11px;
        line-height: 1.25;
        color: var(--pp-ink-sub);
    }
</style>
