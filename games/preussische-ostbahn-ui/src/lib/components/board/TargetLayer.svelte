<script lang="ts">
    import { mapSpace } from '@tabletop/preussische-ostbahn'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexCenter, hexPoints, spaceCenterById } from '$lib/utils/boardGeometry.js'

    const gameSession = getGameSession()
</script>

<g class="targets">
    {#each gameSession.expansionTargets as target (target.spaceId)}
        {@const space = mapSpace(target.spaceId)}
        {@const center = spaceCenterById(target.spaceId)}
        <g
            role="button"
            tabindex="0"
            aria-label={`Build in ${space.city?.name ?? target.spaceId} for $${target.cost}`}
            class="target"
            onclick={() => gameSession.chooseSpace(target.spaceId)}
            onkeydown={(event) => {
                if (event.key === 'Enter' || event.key === ' ')
                    gameSession.chooseSpace(target.spaceId)
            }}
        >
            {#each space.hexes as coords (`${coords.q},${coords.r}`)}
                <polygon points={hexPoints(hexCenter(coords), 36)} class="target-ring"></polygon>
            {/each}
            <g transform={`translate(${center.x + 17}, ${center.y - 20})`}>
                <rect x="-14" y="-9" width="28" height="18" rx="9" class="tag"></rect>
                <text y="4.5" text-anchor="middle" class="tag-text">${target.cost}</text>
            </g>
        </g>
    {/each}
</g>

<style>
    .target {
        cursor: pointer;
    }

    .target-ring {
        fill: rgba(31, 58, 95, 0.1);
        stroke: #1f3a5f;
        stroke-width: 3;
    }

    .target:hover .target-ring,
    .target:focus-visible .target-ring {
        fill: rgba(31, 58, 95, 0.26);
    }

    .target:focus {
        outline: none;
    }

    .tag {
        fill: #1f3a5f;
    }

    .tag-text {
        fill: #f6f1e2;
        font-family: 'Ostbahn Baskerville', Georgia, serif;
        font-size: 11px;
        font-weight: 700;
    }
</style>
