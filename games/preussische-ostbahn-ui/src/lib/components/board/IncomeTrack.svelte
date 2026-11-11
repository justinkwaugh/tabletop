<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { INCOME_AREA } from '$lib/utils/boardGeometry.js'

    const gameSession = getGameSession()
    const { x, y, width, height } = INCOME_AREA

    const LABEL_WIDTH = 104
    const SCALE_LEFT = LABEL_WIDTH + 22
    const SCALE_RIGHT = width - 22
    const AXIS = 50
    const MARKER = 20
    const PILE = 5

    const markers = $derived.by(() => {
        const seen = new Map<number, number>()
        return gameSession.gameState.seatOrder
            .map((playerId) => {
                const income = gameSession.gameState.playerIncome(playerId)
                const level = seen.get(income) ?? 0
                seen.set(income, level + 1)
                return { playerId, income, level }
            })
            .toSorted((a, b) => a.level - b.level)
    })
    const top = $derived(
        Math.max(40, Math.ceil((Math.max(...markers.map((marker) => marker.income)) + 1) / 10) * 10)
    )
    const ticks = $derived(Array.from({ length: top + 1 }, (_, value) => value))

    let picked = $state<number>()
    const shown = $derived(
        picked !== undefined && markers.some((marker) => marker.income === picked)
            ? picked
            : undefined
    )

    function toggle(income: number) {
        picked = picked === income ? undefined : income
    }

    function at(value: number): number {
        return SCALE_LEFT + ((SCALE_RIGHT - SCALE_LEFT) * value) / top
    }
</script>

<g transform={`translate(${x}, ${y})`} class="income">
    <rect {width} {height} rx="8" class="paper"></rect>
    <path
        d={`M8,0 h${LABEL_WIDTH - 8} v${height} h-${LABEL_WIDTH - 8} a8,8 0 0 1 -8,-8 v-${height - 16} a8,8 0 0 1 8,-8 z`}
        fill="#1b2b44"
    ></path>
    <text x={LABEL_WIDTH / 2} y={height / 2 - 4} text-anchor="middle" class="heading">Player</text>
    <text x={LABEL_WIDTH / 2} y={height / 2 + 17} text-anchor="middle" class="heading">income</text>

    <line x1={SCALE_LEFT} x2={SCALE_RIGHT} y1={AXIS} y2={AXIS} class="axis"></line>
    {#each ticks as value (value)}
        {@const major = value % 5 === 0}
        <line
            x1={at(value)}
            x2={at(value)}
            y1={AXIS}
            y2={AXIS + (major ? 7 : 4)}
            class="tick"
            class:major
        ></line>
        {#if major}
            <text x={at(value)} y={AXIS + 19} text-anchor="middle" class="number">{value}</text>
        {/if}
    {/each}

    {#each markers as marker (marker.playerId)}
        {@const color = gameSession.colors.getPlayerUiColor(marker.playerId)}
        {@const ink = gameSession.colors.getPlayerTextColorValue(marker.playerId)}
        <g
            transform={`translate(${at(marker.income) + marker.level * PILE}, ${AXIS - 4 - MARKER / 2 - marker.level * PILE})`}
            role="button"
            tabindex="0"
            aria-label={`${gameSession.getPlayerName(marker.playerId)}: income $${marker.income}`}
            class="pick"
            onclick={() => toggle(marker.income)}
            onkeydown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') toggle(marker.income)
            }}
        >
            <title>{gameSession.getPlayerName(marker.playerId)}: ${marker.income}</title>
            <rect
                x={-MARKER / 2}
                y={-MARKER / 2}
                width={MARKER}
                height={MARKER}
                rx="4"
                fill={color}
                class="marker"
            ></rect>
            <text y="5" text-anchor="middle" class="initial" fill={ink}
                >{gameSession.playerInitial(marker.playerId)}</text
            >
        </g>
    {/each}

    {#if shown !== undefined}
        {@const names = markers
            .filter((marker) => marker.income === shown)
            .map((marker) => gameSession.getPlayerName(marker.playerId))}
        {@const text = `${names.join(', ')} · $${shown}`}
        {@const labelWidth = text.length * 7 + 16}
        <g
            transform={`translate(${Math.min(Math.max(at(shown), SCALE_LEFT + labelWidth / 2), SCALE_RIGHT - labelWidth / 2)}, -16)`}
            pointer-events="none"
        >
            <rect
                x={-labelWidth / 2}
                y="-12"
                width={labelWidth}
                height="22"
                rx="5"
                class="label-box"
            ></rect>
            <text y="4" text-anchor="middle" class="label-text">{text}</text>
        </g>
    {/if}
</g>

<style>
    .paper {
        fill: #f8f3e4;
        stroke: #b9ab86;
        stroke-width: 1.5;
    }

    .heading {
        font-family: 'Ostbahn Alegreya', Georgia, serif;
        font-size: 19px;
        font-weight: 700;
        fill: #efe6cc;
    }

    .axis {
        stroke: #6f6553;
        stroke-width: 1.5;
    }

    .tick {
        stroke: #b5ab95;
        stroke-width: 1;
    }

    .tick.major {
        stroke: #6f6553;
        stroke-width: 1.4;
    }

    .number {
        font-family: 'Ostbahn Baskerville', Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        fill: #5e5546;
    }

    .marker {
        stroke: rgba(0, 0, 0, 0.45);
        stroke-width: 1;
    }

    .pick {
        cursor: pointer;
    }

    .pick:focus {
        outline: none;
    }

    .label-box {
        fill: var(--po-table);
    }

    .label-text {
        font-family: 'Ostbahn Baskerville', Georgia, serif;
        font-size: 12px;
        font-weight: 700;
        fill: var(--po-table-ink);
    }

    .initial {
        font-family: 'Ostbahn Alegreya', Georgia, serif;
        font-size: 14px;
        font-weight: 700;
    }
</style>
