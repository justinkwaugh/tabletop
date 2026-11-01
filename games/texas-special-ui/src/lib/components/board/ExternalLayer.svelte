<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'
    import { CONNECTION_STAR_RADIUS, connectionLabel } from '$lib/utils/mapGeometry.js'
    import { RAILROAD_STYLE } from '$lib/utils/railroadStyle.js'
    import { SHADOW_OFFSET, starPoints } from '$lib/utils/shapes.js'
    import Cube from '../icons/Cube.svelte'

    const gameSession = getGameSession()

    const map = $derived(gameSession.gameState.map)
    const boardWidth = $derived(boardLayout(map.id).width)

    const connections = $derived(
        map.externalConnections.map((connection) => {
            const owner = gameSession.gameState.connections.find(
                (built) => built.connectionId === connection.id
            )?.railroadId
            return {
                ...connection,
                from: map.settlement(connection.settlementId),
                style: owner ? RAILROAD_STYLE[owner] : undefined,
                target: gameSession.connectionTargets.includes(connection.id),
                label: connectionLabel(connection, boardWidth)
            }
        })
    )

    function onKey(event: KeyboardEvent, connectionId: string) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void gameSession.buildConnection(connectionId)
        }
    }
</script>

{#each connections as connection (connection.id)}
    <g class="external">
        <line
            x1={connection.from.x}
            y1={connection.from.y}
            x2={connection.x}
            y2={connection.y}
            class="spur"
            class:built={connection.style}
            stroke={connection.style?.fill ?? '#6c4f9c'}
        />
        <g transform="translate({connection.x} {connection.y})">
            <polygon
                points={starPoints(8, CONNECTION_STAR_RADIUS, 13)}
                transform="translate({SHADOW_OFFSET.x} {SHADOW_OFFSET.y})"
                class="shadow"
            />
            <polygon points={starPoints(8, CONNECTION_STAR_RADIUS, 13)} class="star" />
            {#if connection.style}
                <Cube
                    x={0}
                    y={1}
                    size={26}
                    color={connection.style.fill}
                    edge={connection.style.dark}
                />
            {/if}
        </g>
        <text
            x={connection.label.x}
            y={connection.label.y}
            text-anchor={connection.label.anchor}
            class="name">{connection.name}</text
        >
        <text
            x={connection.label.x}
            y={connection.label.y + 16}
            text-anchor={connection.label.anchor}
            class="terms">cost ${connection.price} · value ${connection.value}</text
        >
        <text
            x={connection.label.x}
            y={connection.label.y + 30}
            text-anchor={connection.label.anchor}
            class="terms">special dividend</text
        >
        {#if connection.target}
            <g
                class="target"
                role="button"
                tabindex="0"
                aria-label="Build the {connection.name} connection for ${connection.price}"
                onclick={() => gameSession.buildConnection(connection.id)}
                onkeydown={(event) => onKey(event, connection.id)}
            >
                <circle cx={connection.x} cy={connection.y} r="32" class="ring" />
            </g>
        {/if}
    </g>
{/each}

<style>
    .spur {
        stroke-width: 3;
        stroke-dasharray: 7 5;
    }

    .spur.built {
        stroke-width: 6;
        stroke-dasharray: none;
    }

    .shadow {
        fill: rgba(16, 23, 31, 0.35);
    }

    .star {
        fill: #7a55b0;
        stroke: #2d1a4a;
        stroke-width: 1.6;
    }

    .name {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 14px;
        font-weight: 700;
        font-style: italic;
        fill: #18222f;
    }

    .terms {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 11.5px;
        font-style: italic;
        fill: #2b3d53;
    }

    .target {
        cursor: pointer;
        outline: none;
    }

    .ring {
        fill: rgba(255, 230, 140, 0.25);
        stroke: #c8961a;
        stroke-width: 3;
        stroke-dasharray: 6 4;
    }

    .target:hover .ring,
    .target:focus-visible .ring {
        fill: rgba(255, 230, 140, 0.55);
    }
</style>
