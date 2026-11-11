<script lang="ts">
    import { SettlementKind, type SettlementDefinition } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { METRO_CELL, boardLayout } from '$lib/utils/boardLayout.js'
    import { mapLabels } from '$lib/utils/mapLabels.js'
    import { RAILROAD_STYLE } from '$lib/utils/railroadStyle.js'
    import { polygonPoints } from '$lib/utils/shapes.js'
    import { SHADOW_OFFSET } from '$lib/utils/shapes.js'

    const gameSession = getGameSession()

    const SYMBOL_FILL: Partial<Record<SettlementKind, string>> = {
        [SettlementKind.AgriculturalRailhead]: '#f2b81e',
        [SettlementKind.RailroadStation]: '#2d58b0',
        [SettlementKind.MercantileCenter]: '#d42a22',
        [SettlementKind.NaturalResource]: '#f5df1f'
    }
    const UNOWNED_BASE_FILL = '#8a7860'

    const map = $derived(gameSession.gameState.map)
    const layout = $derived(boardLayout(map.id))
    const labels = $derived(mapLabels(map.id))

    const leaveTargets = $derived(new Set(gameSession.leaveTownTargets))

    const developTargets = $derived(
        new Map(gameSession.developTargets.map((target) => [target.settlementId, target]))
    )

    const settlements = $derived(
        map.settlements.map((place) => {
            const level = gameSession.gameState.developmentLevel(place.id)
            return {
                ...place,
                level,
                income: map.incomeLevels(place.id)[level],
                target: developTargets.get(place.id)
            }
        })
    )

    function developedRingRadius(place: SettlementDefinition): number {
        const { width, height } = labels.settlementIconBox(place)
        return Math.max(width, height) / 2 + 5
    }

    function symbolFill(place: SettlementDefinition): string {
        const homeOf = map.homeOf(place.id)
        return SYMBOL_FILL[place.kind] ?? (homeOf ? RAILROAD_STYLE[homeOf].fill : UNOWNED_BASE_FILL)
    }

    function metroCells(place: SettlementDefinition) {
        const grid = layout.metroGrid(place.id)
        return map.incomeLevels(place.id).map((value, index) => ({
            value,
            index,
            x: grid.origin.x + (index % grid.columns) * METRO_CELL,
            y: grid.origin.y + Math.floor(index / grid.columns) * METRO_CELL
        }))
    }

    function targetBounds(place: SettlementDefinition) {
        return place.kind === SettlementKind.MetroArea
            ? labels.settlementIconBox(place)
            : { x: place.x - 22, y: place.y - 22, width: 44, height: 44 }
    }

    function onLeaveKey(event: KeyboardEvent, settlementId: string) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void gameSession.leaveTown(settlementId)
        }
    }

    function onKey(event: KeyboardEvent, settlementId: string) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void gameSession.develop(settlementId)
        }
    }
</script>

{#snippet symbol(place: SettlementDefinition, fill: string | undefined)}
    {#if place.kind === SettlementKind.RailroadStation}
        <rect x="-13.5" y="-13.5" width="27" height="27" rx="2" {fill} class:symbol={fill} />
    {:else if place.kind === SettlementKind.AgriculturalRailhead || place.kind === SettlementKind.NaturalResource}
        <polygon points={polygonPoints(6, 18.5)} {fill} class:symbol={fill} />
    {:else if place.kind === SettlementKind.MercantileCenter}
        <circle r="16.3" {fill} class:symbol={fill} />
    {:else}
        <polygon points={polygonPoints(5, 23)} {fill} class:symbol={fill} />
    {/if}
{/snippet}

<g class="settlement-layer">
    {#each labels.baseNames as base (base.railroadId)}
        <text x={base.x} y={base.y} class="base-name" fill={RAILROAD_STYLE[base.railroadId].fill}
            >{map.railroad(base.railroadId).shortName}</text
        >
    {/each}

    {#each settlements as place (place.id)}
        {@const label = labels.settlementLabels[place.id]}
        {#if label}
            <text
                x={label.x}
                y={label.y}
                class="name"
                transform={label.rotate
                    ? `rotate(${label.rotate} ${label.x} ${label.y})`
                    : undefined}>{place.name}</text
            >
        {/if}
    {/each}

    {#each settlements as place (place.id)}
        <g class="settlement">
            {#if place.kind === SettlementKind.MetroArea}
                {@const frame = labels.metroFrameBox(place)}
                {@const caption = labels.metroCaption(place)}
                {#each caption ? [caption, frame] : [frame] as box, index (index)}
                    <rect
                        x={box.x + SHADOW_OFFSET.x}
                        y={box.y + SHADOW_OFFSET.y}
                        width={box.width}
                        height={box.height}
                        rx="4"
                        class="shadow"
                    />
                {/each}
                {#if caption}
                    <rect
                        x={caption.x}
                        y={caption.y}
                        width={caption.width}
                        height={caption.height}
                        rx="4"
                        class="metro-caption"
                    />
                    <text
                        x={caption.x + caption.width / 2}
                        y={caption.y + caption.height / 2 + 4.5}
                        class="metro-name">{place.name}</text
                    >
                {/if}
                <rect
                    x={frame.x}
                    y={frame.y}
                    width={frame.width}
                    height={frame.height}
                    rx="4"
                    class="metro-frame"
                />
                {#each metroCells(place) as cell (cell.value)}
                    <rect
                        x={cell.x}
                        y={cell.y}
                        width={METRO_CELL}
                        height={METRO_CELL}
                        class="metro-cell"
                        class:current={cell.index === place.level}
                        class:passed={cell.index < place.level}
                    />
                    <text
                        x={cell.x + METRO_CELL / 2}
                        y={cell.y + METRO_CELL / 2 + 5.5}
                        class="metro-value"
                        class:current={cell.index === place.level}>{cell.value}</text
                    >
                {/each}
                {#if place.level > 0}
                    {@const current = metroCells(place)[place.level]}
                    <rect
                        x={current.x - 2}
                        y={current.y - 2}
                        width={METRO_CELL + 4}
                        height={METRO_CELL + 4}
                        rx="4"
                        class="developed-halo"
                    />
                    <rect
                        x={current.x - 2}
                        y={current.y - 2}
                        width={METRO_CELL + 4}
                        height={METRO_CELL + 4}
                        rx="4"
                        class="developed-ring"
                    />
                {/if}
            {:else}
                <g transform="translate({place.x} {place.y})">
                    <g transform="translate({SHADOW_OFFSET.x} {SHADOW_OFFSET.y})" class="shadow">
                        {@render symbol(place, undefined)}
                    </g>
                    {@render symbol(place, symbolFill(place))}
                    <text
                        y="5"
                        class="income"
                        class:dark={place.kind === SettlementKind.AgriculturalRailhead ||
                            place.kind === SettlementKind.NaturalResource}>{place.income}</text
                    >
                    {#if place.level > 0}
                        {@const radius = developedRingRadius(place)}
                        <circle r={radius} class="developed-halo" />
                        <circle r={radius} class="developed-ring" />
                    {/if}
                </g>
            {/if}
        </g>
    {/each}

    {#each settlements as place (place.id)}
        {#if leaveTargets.has(place.id)}
            {@const bounds = targetBounds(place)}
            <!-- Where a settlement can also be developed, the develop ring above takes the click and
                 the action panel's Leave button leaves. -->
            <g
                class="leave-target"
                role="button"
                tabindex="0"
                aria-label="Leave {place.name}"
                onclick={() => gameSession.leaveTown(place.id)}
                onkeydown={(event) => onLeaveKey(event, place.id)}
            >
                <rect
                    x={bounds.x - 10}
                    y={bounds.y - 10}
                    width={bounds.width + 20}
                    height={bounds.height + 20}
                    rx="12"
                    class="leave-ring"
                />
            </g>
        {/if}
    {/each}

    {#each settlements as place (place.id)}
        {#if place.target}
            {@const bounds = targetBounds(place)}
            <g
                class="develop-target"
                role="button"
                tabindex="0"
                aria-label="Develop {place.name}{place.target.cost > 0
                    ? ` for $${place.target.cost}`
                    : ''}"
                onclick={() => gameSession.develop(place.id)}
                onkeydown={(event) => onKey(event, place.id)}
            >
                <rect
                    x={bounds.x - 5}
                    y={bounds.y - 5}
                    width={bounds.width + 10}
                    height={bounds.height + 10}
                    rx="9"
                    class="ring"
                />
                {#each place.target.gains as entry, index (entry.railroadId)}
                    {@const style = RAILROAD_STYLE[entry.railroadId]}
                    <g
                        transform="translate({bounds.x + bounds.width / 2} {bounds.y +
                            bounds.height +
                            12 +
                            index * 17})"
                        class="gain-chip"
                    >
                        <rect x="-19" y="-8" width="38" height="15" rx="3" fill={style.fill} />
                        <text y="4" fill={style.text}>+{entry.gain}</text>
                    </g>
                {/each}
            </g>
        {/if}
    {/each}
</g>

<style>
    .name {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13.5px;
        font-style: italic;
        fill: #131b24;
        paint-order: stroke;
        stroke: rgba(246, 238, 215, 0.85);
        stroke-width: 3px;
        pointer-events: none;
    }

    .base-name {
        font-family: 'SAR Oswald', 'Arial Narrow', sans-serif;
        font-size: 27px;
        font-weight: 500;
        letter-spacing: 0.06em;
        paint-order: stroke;
        stroke: #f6eed7;
        stroke-width: 4px;
        pointer-events: none;
    }

    .shadow {
        fill: rgba(16, 23, 31, 0.35);
    }

    .developed-halo {
        fill: none;
        stroke: #fdfaf0;
        stroke-width: 8;
        pointer-events: none;
    }

    .developed-ring {
        fill: none;
        stroke: #7c7c7c;
        stroke-width: 4;
        pointer-events: none;
    }

    .gain-chip text {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 12px;
        font-weight: 700;
        text-anchor: middle;
        pointer-events: none;
    }

    .symbol {
        stroke: #0d1219;
        stroke-width: 1.6;
    }

    .income {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 14px;
        font-weight: 700;
        fill: #ffffff;
        text-anchor: middle;
        pointer-events: none;
    }

    .income.dark {
        fill: #10171f;
    }

    .metro-frame {
        fill: #1a2633;
    }

    .metro-caption {
        fill: #f7efd9;
        stroke: #1a2633;
        stroke-width: 2;
    }

    .metro-name {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 12.5px;
        font-style: italic;
        font-weight: 700;
        fill: #131b24;
        text-anchor: middle;
    }

    .metro-cell {
        fill: #fdf8ea;
        stroke: #1a2633;
        stroke-width: 1.2;
    }

    .metro-cell.passed {
        fill: #e2d6b8;
    }

    .metro-cell.current {
        fill: #ffe08a;
    }

    .metro-value {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 15px;
        font-weight: 700;
        fill: #3f597a;
        text-anchor: middle;
        pointer-events: none;
    }

    .metro-value.current {
        fill: #10171f;
    }

    .develop-target {
        cursor: pointer;
        outline: none;
    }

    .ring {
        fill: rgba(255, 230, 140, 0.18);
        stroke: #c8961a;
        stroke-width: 3;
        stroke-dasharray: 6 4;
    }

    .leave-target {
        cursor: pointer;
        outline: none;
    }

    .leave-ring {
        fill: rgba(196, 42, 34, 0.08);
        stroke: #b0262e;
        stroke-width: 3;
        stroke-dasharray: 2 4;
    }

    .leave-target:hover .leave-ring,
    .leave-target:focus-visible .leave-ring {
        fill: rgba(196, 42, 34, 0.22);
    }

    .develop-target:hover .ring,
    .develop-target:focus-visible .ring {
        fill: rgba(255, 230, 140, 0.5);
    }
</style>
