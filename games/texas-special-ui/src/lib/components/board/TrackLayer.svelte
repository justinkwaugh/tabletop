<script lang="ts">
    import { linkOwner } from '@tabletop/texas-special'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { LINK_BOX_SIZE } from '$lib/utils/boardLayout.js'
    import { linkPath } from '$lib/utils/mapGeometry.js'
    import { RAILROAD_STYLE } from '$lib/utils/railroadStyle.js'
    import Cube from '../icons/Cube.svelte'

    const gameSession = getGameSession()

    const targets = $derived(new Set(gameSession.linkTargets))
    const builder = $derived(gameSession.buildingRailroad)
    const builderStyle = $derived(builder ? RAILROAD_STYLE[builder] : undefined)

    const map = $derived(gameSession.gameState.map)

    const links = $derived(
        map.links.map((trackLink) => {
            const owner = linkOwner(gameSession.gameState, trackLink.id)
            return {
                ...trackLink,
                path: linkPath(map, trackLink.id),
                label: trackLink.ends.map((id) => map.settlement(id).name).join(' to '),
                style: owner ? RAILROAD_STYLE[owner] : undefined,
                target: targets.has(trackLink.id),
                gain: gameSession.gameState.buildIncomeGain(trackLink.id),
                chosen: gameSession.firstLink === trackLink.id
            }
        })
    )

    function onKey(event: KeyboardEvent, linkId: string) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void gameSession.clickLink(linkId)
        }
    }
</script>

<g class="track-layer">
    {#each links as trackLink (trackLink.id)}
        <g class="link" class:built={trackLink.style}>
            <path d={trackLink.path} class="ties" />
            {#if trackLink.style}
                <path d={trackLink.path} class="rail-built-edge" />
                <path d={trackLink.path} class="rail-built" stroke={trackLink.style.fill} />
            {:else}
                <path d={trackLink.path} class="rail" />
            {/if}
        </g>
    {/each}

    {#each links as trackLink (trackLink.id)}
        {#if trackLink.target || trackLink.chosen}
            <path
                d={trackLink.path}
                class="target-glow"
                class:chosen={trackLink.chosen}
                stroke={builderStyle?.light ?? '#ffcf3f'}
            />
        {/if}
    {/each}

    {#each links as trackLink (trackLink.id)}
        <g transform="translate({trackLink.box.x} {trackLink.box.y})">
            {#if trackLink.style}
                <Cube
                    x={0}
                    y={1}
                    size={LINK_BOX_SIZE}
                    color={trackLink.style.fill}
                    edge={trackLink.style.dark}
                />
            {:else if trackLink.chosen && builderStyle}
                <Cube
                    x={0}
                    y={1}
                    size={LINK_BOX_SIZE}
                    color={builderStyle.fill}
                    edge={builderStyle.dark}
                />
            {:else}
                <rect
                    x={-LINK_BOX_SIZE / 2}
                    y={-LINK_BOX_SIZE / 2}
                    width={LINK_BOX_SIZE}
                    height={LINK_BOX_SIZE}
                    rx="3.5"
                    class="box"
                />
            {/if}
        </g>
    {/each}

    {#each links as trackLink (trackLink.id)}
        {#if trackLink.target}
            <g
                class="hit"
                role="button"
                tabindex="0"
                aria-label="Build {trackLink.label}, adding ${trackLink.gain} income"
                onclick={() => gameSession.clickLink(trackLink.id)}
                onkeydown={(event) => onKey(event, trackLink.id)}
            >
                <path d={trackLink.path} class="hit-path" />
                <rect
                    x={trackLink.box.x - LINK_BOX_SIZE / 2 - 5}
                    y={trackLink.box.y - LINK_BOX_SIZE / 2 - 5}
                    width={LINK_BOX_SIZE + 10}
                    height={LINK_BOX_SIZE + 10}
                    rx="6"
                    class="hit-box"
                    stroke={builderStyle?.fill ?? '#c8961a'}
                />
                <text x={trackLink.box.x} y={trackLink.box.y + 5} class="gain"
                    >+{trackLink.gain}</text
                >
            </g>
        {/if}
    {/each}
</g>

<style>
    .ties {
        fill: none;
        stroke: #354b66;
        stroke-width: 10;
        stroke-dasharray: 1.6 5.4;
        opacity: 0.85;
    }

    .rail {
        fill: none;
        stroke: #354b66;
        stroke-width: 2.6;
        stroke-linejoin: round;
    }

    .rail-built-edge {
        fill: none;
        stroke: #0d1219;
        stroke-width: 8.5;
        stroke-linejoin: round;
        stroke-linecap: round;
    }

    .rail-built {
        fill: none;
        stroke-width: 6;
        stroke-linejoin: round;
        stroke-linecap: round;
    }

    .box {
        fill: #fffdf6;
        stroke: #1a2633;
        stroke-width: 1.6;
    }

    .target-glow {
        fill: none;
        stroke-width: 15;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: 0.55;
        pointer-events: none;
    }

    .target-glow.chosen {
        opacity: 0.9;
        stroke-width: 18;
    }

    .hit {
        cursor: pointer;
        outline: none;
    }

    .hit-path {
        fill: none;
        stroke: transparent;
        stroke-width: 22;
    }

    .hit-box {
        fill: rgba(255, 244, 200, 0.35);
        stroke-width: 3;
        stroke-dasharray: 5 3;
    }

    .gain {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 14px;
        font-weight: 700;
        fill: #10171f;
        text-anchor: middle;
        pointer-events: none;
    }

    .hit:hover .hit-box,
    .hit:focus-visible .hit-box {
        fill: rgba(255, 236, 160, 0.75);
    }
</style>
