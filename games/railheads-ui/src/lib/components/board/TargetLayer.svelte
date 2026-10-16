<script lang="ts">
    import { PlacementKind, hexKey } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { HEX_RADIUS, hexCenter, hexPoints } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()

    const targets = $derived(
        gameSession.trackTargets.map((target) => ({
            ...target,
            key: hexKey(target.coords),
            center: hexCenter(target.coords),
            label: target.kind === PlacementKind.Cube ? `cube $${target.cost}` : `$${target.cost}`
        }))
    )

    function onKey(event: KeyboardEvent, action: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            action()
        }
    }
</script>

{#each targets as target (target.key)}
    <g
        class="target"
        role="button"
        tabindex="0"
        aria-label="Lay a {target.kind === PlacementKind.Cube ? 'crossing cube' : 'disc'} here for {target.label}"
        onclick={() => gameSession.clickHex(target.coords)}
        onkeydown={(event) => onKey(event, () => gameSession.clickHex(target.coords))}
    >
        <polygon class="wash" points={hexPoints(target.center, HEX_RADIUS - 4)} />
        <polygon class="ring" points={hexPoints(target.center, HEX_RADIUS - 5)} />
        <g transform="translate({target.center.x} {target.center.y + 13})">
            <rect x={-target.label.length * 3.6 - 4} y="-8" width={target.label.length * 7.2 + 8} height="15" rx="4" class="tag" />
            <text y="3.5" class="price">{target.label}</text>
        </g>
    </g>
{/each}

<style>
    .target {
        cursor: pointer;
        outline: none;
    }

    .wash {
        fill: rgba(255, 246, 200, 0.35);
    }

    .ring {
        fill: none;
        stroke: #7b1630;
        stroke-width: 3.5;
        stroke-dasharray: 7 4;
    }

    .target:hover .wash,
    .target:focus-visible .wash {
        fill: rgba(255, 246, 200, 0.7);
    }

    .tag {
        fill: #7b1630;
    }

    .price {
        fill: #ffffff;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 11px;
        font-weight: 700;
        text-anchor: middle;
    }
</style>
