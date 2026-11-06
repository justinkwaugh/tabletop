<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import type { BoundingBox, Point } from '@tabletop/common'
    import { WELL_BONUS_POINTS, WallSide, type WallSection } from '@tabletop/medina'
    import { boardArt, hasSprite, sheetUrl, spriteBox } from '$lib/art/sprites.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { ROOFTOP_SPRITE_NEUTRAL, type BoardTarget } from '$lib/model/session.svelte'
    import { GHOST_OPACITY } from '$lib/animators/pieceArrival.js'
    import {
        SIDEWAYS_CONTROLS_ROOM,
        UNITS_PER_CELL,
        croppedToCity,
        footprint,
        uprightMatrix,
        polygonPoints,
        project,
        projectView,
        convexHull,
        worldOfSpace,
        worldOfWall
    } from '$lib/utils/boardGeometry.js'
    import { tileLayout } from '$lib/utils/boardLayout.js'
    import {
        buildingSprite,
        spaceKey,
        merchantSprite,
        paintOrder,
        recentMarks,
        rooftopOn,
        scoringPieceKeys,
        stableSprite,
        wallSprite
    } from '$lib/utils/boardPieces.js'
    import Sprite from './Sprite.svelte'
    import TileArt from './TileArt.svelte'
    import TowerTile from './TowerTile.svelte'

    const session = getGameSession()

    const NATURAL_SCALE = 0.5
    const ROOF_HEIGHT = 0.645
    const SPACE_TARGET_HALF = 0.3
    const WALL_TARGET_LENGTH = 0.42
    const WALL_TARGET_WIDTH = 0.15
    const SPACE_REACH_HALF = 0.42
    const WALL_REACH_LENGTH = 0.47
    const WALL_REACH_WIDTH = 0.2
    const TILE_MERCHANT_SPACING = 0.28
    const TILE_MERCHANT_DOWN = 0.31
    const TILE_MERCHANT_UNITS = 80
    const TILE_ROOF_LEFT = 0.14
    const TILE_ROOF_DOWN = 0.04
    const BOARD_EDGE = 14
    const TILE_LABEL_HEIGHT = 0.2
    const TILE_LABEL_DROP = 15
    const TILE_LABEL_INK = '#2a1609'
    const RECENT_DOT_RADIUS = 11
    const WELL_BONUS_TEXT_DROP = 13
    const WALL_TINT_STRENGTH = 0.85

    const shown = $derived(session.pieceState)
    const projection = $derived(session.projection)
    const size = $derived(projection.size)
    const view = $derived(projection.view)
    const art = $derived(boardArt(view, shown.players.length === 2, projection.sideways))
    const artBox: BoundingBox = $derived({
        x: art.x0 * UNITS_PER_CELL,
        y: -(art.y0 + art.h) * UNITS_PER_CELL,
        width: art.w * UNITS_PER_CELL,
        height: art.h * UNITS_PER_CELL
    })
    const crop: BoundingBox | undefined = $derived(
        projection.sideways ? croppedToCity(projection) : undefined
    )
    const box: BoundingBox = $derived(
        crop ? { ...crop, height: crop.height + SIDEWAYS_CONTROLS_ROOM * UNITS_PER_CELL } : artBox
    )

    const focusedKeys = $derived(
        session.focusedPalaceId ? scoringPieceKeys(shown, session.focusedPalaceId) : undefined
    )

    let hoveredKey: string | undefined = $state()
    const hoveredTarget = $derived(
        session.targets.find((target) => targetKey(target) === hoveredKey)
    )

    const attachBoard: Attachment<SVGSVGElement> = (node) => {
        session.boardElement = node
        return () => {
            session.boardElement = undefined
        }
    }

    function sectionWorld(section: WallSection) {
        return worldOfWall(section, size)
    }

    function wallFootprint(section: WallSection, length: number, width: number) {
        const along = section.side === WallSide.North || section.side === WallSide.South
        return footprint(
            projection,
            sectionWorld(section),
            along ? length : width,
            along ? width : length
        )
    }

    function targetPolygon(target: BoardTarget): string {
        switch (target.kind) {
            case 'wall':
                return polygonPoints(
                    wallFootprint(target.section, WALL_TARGET_LENGTH, WALL_TARGET_WIDTH)
                )
            case 'roof':
                return polygonPoints(
                    footprint(
                        projection,
                        worldOfSpace(target.coords, size),
                        SPACE_TARGET_HALF,
                        SPACE_TARGET_HALF,
                        ROOF_HEIGHT
                    )
                )
            case 'space':
                return polygonPoints(
                    footprint(
                        projection,
                        worldOfSpace(target.coords, size),
                        SPACE_TARGET_HALF,
                        SPACE_TARGET_HALF
                    )
                )
        }
    }

    function targetReach(target: BoardTarget): string {
        switch (target.kind) {
            case 'wall':
                return polygonPoints(
                    wallFootprint(target.section, WALL_REACH_LENGTH, WALL_REACH_WIDTH)
                )
            case 'roof': {
                const world = worldOfSpace(target.coords, size)
                return polygonPoints(
                    convexHull([
                        ...footprint(projection, world, SPACE_REACH_HALF, SPACE_REACH_HALF),
                        ...footprint(
                            projection,
                            world,
                            SPACE_REACH_HALF,
                            SPACE_REACH_HALF,
                            ROOF_HEIGHT
                        )
                    ])
                )
            }
            case 'space':
                return polygonPoints(
                    footprint(
                        projection,
                        worldOfSpace(target.coords, size),
                        SPACE_REACH_HALF,
                        SPACE_REACH_HALF
                    )
                )
        }
    }

    function targetLabel(target: BoardTarget): string {
        switch (target.kind) {
            case 'wall':
                return `Build the ${target.section.side} wall here`
            case 'roof':
                return `Claim this palace, rooftop on column ${target.coords.x + 1}, row ${target.coords.y + 1}`
            case 'space':
                return `Place here, column ${target.coords.x + 1}, row ${target.coords.y + 1}`
        }
    }

    function tintFilterId(pieceKey: string): string {
        return `medina-tint-${pieceKey.replace(/[^\w-]/g, '_')}`
    }

    function targetKey(target: BoardTarget): string {
        return target.kind === 'wall'
            ? `wall:${target.section.side}:${target.section.position}`
            : `${target.kind}:${target.coords.x},${target.coords.y}`
    }

    function ghostOf(target: BoardTarget): { sprite: string; anchor: Point } | undefined {
        const tool = session.activeTool
        if (!tool) {
            return undefined
        }
        if (target.kind === 'wall') {
            return {
                sprite: wallSprite(target.section, projection.sideways),
                anchor: project(projection, sectionWorld(target.section))
            }
        }
        const anchor = project(projection, worldOfSpace(target.coords, size))
        switch (tool.kind) {
            case 'building':
                return { sprite: buildingSprite(tool.color, target.coords), anchor }
            case 'stable':
                return { sprite: stableSprite(target.coords), anchor }
            case 'merchant':
                return { sprite: merchantSprite(target.coords), anchor }
            case 'rooftop':
                return { sprite: rooftopOn(session.myRooftopSprite, target.coords), anchor }
            case 'neutralRooftop':
                return { sprite: rooftopOn(ROOFTOP_SPRITE_NEUTRAL, target.coords), anchor }
            case 'wall':
                return undefined
        }
    }

    const ghost = $derived(
        hoveredTarget && !session.updatingVisibleState ? ghostOf(hoveredTarget) : undefined
    )

    const layered = $derived.by(() => {
        const pieces = session.pieces.map((piece) => ({
            key: piece.key,
            anchor: piece.anchor,
            piece
        }))
        return ghost
            ? [...pieces, { key: 'ghost', anchor: ghost.anchor, piece: undefined }].toSorted(
                  paintOrder
              )
            : pieces
    })

    const wellBonuses = $derived(
        shown.wellBonusSpaces().map((space) => {
            const world = worldOfSpace(space, size)
            const center = project(projection, world)
            return {
                key: `${space.x},${space.y}`,
                center: { x: center.x, y: center.y + WELL_BONUS_TEXT_DROP }
            }
        })
    )

    const groundTargets = $derived(session.targets.filter((target) => target.kind !== 'roof'))
    const roofTargets = $derived(
        new Map(
            session.targets.flatMap((target) =>
                target.kind === 'roof' ? [[spaceKey('building', target.coords), target]] : []
            )
        )
    )

    const coloredMarks = $derived(
        recentMarks(session.pieces, session.recent).map((mark) => ({
            ...mark,
            color: session.colors.getPlayerUiColor(mark.playerId)
        }))
    )
    // One filter per wall, its region the wall's frame (see spriteBox).
    const wallTints = $derived(
        coloredMarks.flatMap(({ piece, color }) =>
            piece.tintedWhenRecent
                ? [
                      {
                          key: piece.key,
                          color,
                          region: spriteBox(view, piece.sprite, piece.anchor, UNITS_PER_CELL)
                      }
                  ]
                : []
        )
    )
    const tintedKeys = $derived(new Set(wallTints.map((tint) => tint.key)))

    function place(target: BoardTarget) {
        const overGhost = ghost !== undefined
        hoveredKey = undefined
        session.placeAt(target, overGhost)
    }

    function onTargetKey(event: KeyboardEvent, target: BoardTarget) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            place(target)
        }
    }

    const layout = $derived(tileLayout(size, projection.sideways))
    const palaceTiles = $derived(
        shown.palaceTiles.map((tile, index) => ({ tile, world: layout.palaceTiles[index] }))
    )
    const towerTiles = $derived(
        shown.towerTiles.map((tile) => ({ tile, world: layout.towers[tile.tower] }))
    )

    function tileRoofAt(world: Point, tileSize: number): Point {
        return {
            x: world.x - tileSize * TILE_ROOF_LEFT,
            y: world.y - tileSize * TILE_ROOF_DOWN
        }
    }

    function towerTileRoof(palaceId: string | undefined, world: Point, tileSize: number) {
        const playerId = shown.ownerOf(palaceId)
        return playerId
            ? {
                  sprite: `${session.rooftopSprite({ coords: world, playerId })}-0`,
                  anchor: projectView(projection, tileRoofAt(world, tileSize), -ROOF_HEIGHT)
              }
            : undefined
    }

    function palaceTileRoof(palaceId: string | undefined, world: Point, tileSize: number) {
        if (palaceId === undefined) {
            return undefined
        }
        const playerId = shown.ownerOf(palaceId)
        const roofAt = tileRoofAt(world, tileSize)
        const label = projectView(projection, roofAt, TILE_LABEL_HEIGHT)
        return {
            sprite: `${session.rooftopSprite({ coords: world, playerId })}-0`,
            anchor: projectView(projection, roofAt, -ROOF_HEIGHT),
            size: shown.palaceSize(palaceId),
            sizeColor: playerId ? session.colors.getPlayerTextColorValue(playerId) : TILE_LABEL_INK,
            sizeAt: { x: label.x, y: label.y + TILE_LABEL_DROP }
        }
    }

    const teaLeft = $derived(shown.teaTilesForNextPurpleClaim())

    const finalScores = $derived(
        shown.result
            ? session.pieces.flatMap((piece) => {
                  if (!piece.rooftop || !piece.palaceId) {
                      return []
                  }
                  const palace = shown.palace(piece.palaceId)
                  const owner = palace.rooftop?.playerId
                  return [
                      {
                          key: piece.key,
                          at: piece.rooftop.markAt,
                          total: shown.palaceScore(palace).total,
                          color: owner
                              ? session.colors.getPlayerTextColorValue(owner)
                              : TILE_LABEL_INK
                      }
                  ]
              })
            : []
    )

    function focusOnHover(event: PointerEvent, palaceId: string | undefined) {
        if (event.pointerType === 'mouse') {
            session.focusPalace(palaceId)
        }
    }

    // Touch focuses on click: a drag that pans the board ends in pointerup but sends no click.
    let pressedWithMouse = false

    function notePointerType(event: PointerEvent) {
        pressedWithMouse = event.pointerType === 'mouse'
    }

    function focusOnTap(event: MouseEvent, palaceId: string) {
        if (!pressedWithMouse) {
            event.stopPropagation()
            session.togglePalaceFocus(palaceId)
        }
    }

    function clearFocusOnTap() {
        if (!pressedWithMouse) {
            session.focusPalace(undefined)
        }
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<svg
    class="board"
    class:dimming={!!focusedKeys}
    width={box.width * NATURAL_SCALE}
    height={box.height * NATURAL_SCALE}
    viewBox="{box.x} {box.y} {box.width} {box.height}"
    onpointerdowncapture={notePointerType}
    onclick={clearFocusOnTap}
    {@attach attachBoard}
>
    {#if crop}
        <clipPath id="medina-board-crop">
            <rect x={crop.x} y={crop.y} width={crop.width} height={crop.height}></rect>
        </clipPath>
    {/if}
    <image
        clip-path={crop ? 'url(#medina-board-crop)' : undefined}
        href={art.url}
        x={artBox.x}
        y={artBox.y}
        width={artBox.width}
        height={artBox.height}
        preserveAspectRatio="none"
    ></image>

    <g class="loose-tiles">
        {#each palaceTiles as { tile, world } (tile.color)}
            {@const roof = palaceTileRoof(tile.palaceId, world, layout.palaceTileSize)}
            <g data-tile="palace-{tile.color}" transform={uprightMatrix(projection, world)}>
                <TileArt name="palace-{tile.color}" size={layout.palaceTileSize} />
            </g>
            {#if roof}
                <g class="tile-roof">
                    <Sprite sheet={view} name={roof.sprite} anchor={roof.anchor} />
                    <text
                        class="tile-size"
                        x={roof.sizeAt.x}
                        y={roof.sizeAt.y}
                        text-anchor="middle"
                        fill={roof.sizeColor}>{roof.size}</text
                    >
                </g>
            {/if}
        {/each}
        {#each towerTiles as { tile, world } (tile.tower)}
            {@const roof = towerTileRoof(tile.palaceId, world, layout.towerTileSize)}
            <g data-tile="tower-{tile.tower}" transform={uprightMatrix(projection, world)}>
                <TowerTile
                    tower={tile.tower}
                    size={layout.towerTileSize}
                    hasMerchants={shown.towerTileMerchants(tile) > 0}
                />
            </g>
            {#if roof}
                <g class="tile-roof">
                    <Sprite sheet={view} name={roof.sprite} anchor={roof.anchor} />
                </g>
            {/if}
            {@const merchants = shown.towerTileMerchants(tile)}
            {#each { length: merchants } as _, index (index)}
                <Sprite
                    sheet={view}
                    name="merchant-0"
                    unitsPerCell={TILE_MERCHANT_UNITS}
                    anchor={projectView(projection, {
                        x:
                            world.x +
                            (index - (merchants - 1) / 2) *
                                layout.towerTileSize *
                                TILE_MERCHANT_SPACING,
                        y: world.y - layout.towerTileSize * TILE_MERCHANT_DOWN
                    })}
                />
            {/each}
        {/each}
        {#if teaLeft > 0}
            <g data-tile="tea" transform={uprightMatrix(projection, layout.tea)}>
                <TileArt name="tea" size={layout.teaSize} badge={teaLeft} />
            </g>
        {/if}
    </g>

    <defs>
        {#each wallTints as { key, color, region } (key)}
            <filter
                id={tintFilterId(key)}
                filterUnits="userSpaceOnUse"
                x={region.x}
                y={region.y}
                width={region.width}
                height={region.height}
                color-interpolation-filters="sRGB"
            >
                <feFlood flood-color={color} flood-opacity={WALL_TINT_STRENGTH} result="flood"
                ></feFlood>
                <feComposite in="flood" in2="SourceAlpha" operator="in" result="tint"></feComposite>
                <feBlend in="tint" in2="SourceGraphic" mode="multiply"></feBlend>
            </filter>
        {/each}
    </defs>

    <g class="well-bonuses">
        {#each wellBonuses as { key, center } (key)}
            <text class="well-bonus" x={center.x} y={center.y} text-anchor="middle"
                >+{WELL_BONUS_POINTS}</text
            >
        {/each}
    </g>

    <g class="recent-squares">
        {#each coloredMarks as { key, piece, color } (key)}
            {#if piece.groundMark}
                <polygon class="recent-square" points={piece.groundMark} fill={color}></polygon>
            {/if}
        {/each}
    </g>

    {#if view === 'cavalier'}
        <g class="shadows">
            {#each session.pieces as piece (piece.key)}
                {#if hasSprite('cavalier-shadows', piece.sprite)}
                    <g data-shadow-key={piece.key}>
                        <Sprite
                            sheet="cavalier-shadows"
                            name={piece.sprite}
                            anchor={piece.anchor}
                        />
                    </g>
                {/if}
            {/each}
        </g>
    {/if}

    {#if crop}
        <rect
            class="board-edge"
            x={crop.x + BOARD_EDGE / 2}
            y={crop.y + BOARD_EDGE / 2}
            width={crop.width - BOARD_EDGE}
            height={crop.height - BOARD_EDGE}
            stroke-width={BOARD_EDGE}
        ></rect>
    {/if}

    {#if !session.updatingVisibleState}
        <g class="target-marks">
            {#each groundTargets as target (targetKey(target))}
                <polygon
                    class="target-mark"
                    class:hovered={hoveredKey === targetKey(target)}
                    points={targetPolygon(target)}
                ></polygon>
            {/each}
        </g>
    {/if}

    <g class="pieces">
        {#each layered as entry (entry.key)}
            {#if entry.piece}
                {@const piece = entry.piece}
                {@const lit = !focusedKeys || focusedKeys.has(piece.key)}
                {@const roofTarget = session.updatingVisibleState
                    ? undefined
                    : roofTargets.get(piece.key)}
                <g class="piece" class:dim={!lit}>
                    <g
                        data-arrival-key={piece.key}
                        filter={tintedKeys.has(piece.key)
                            ? `url(#${tintFilterId(piece.key)})`
                            : undefined}
                    >
                        <Sprite sheet={view} name={piece.sprite} anchor={piece.anchor} />
                    </g>
                    {#if piece.rooftop}
                        <g data-arrival-key={piece.rooftop.key}>
                            <Sprite
                                sheet={view}
                                name={piece.rooftop.sprite}
                                anchor={piece.anchor}
                            />
                        </g>
                    {/if}
                    {#if roofTarget}
                        <polygon
                            class="target-mark"
                            class:hovered={hoveredKey === targetKey(roofTarget)}
                            points={targetPolygon(roofTarget)}
                        ></polygon>
                    {/if}
                    {#if piece.outline && piece.palaceId}
                        {@const palaceId = piece.palaceId}
                        <polygon
                            class="hit"
                            data-palace={palaceId}
                            points={piece.outline}
                            role="presentation"
                            onpointermove={(event) => focusOnHover(event, palaceId)}
                            onpointerleave={(event) => focusOnHover(event, undefined)}
                            onclick={(event) => focusOnTap(event, palaceId)}
                        ></polygon>
                    {/if}
                </g>
            {:else if ghost}
                <g class="ghost" style:opacity={GHOST_OPACITY}>
                    <Sprite sheet={view} name={ghost.sprite} anchor={ghost.anchor} />
                </g>
            {/if}
        {/each}
    </g>

    <g class="final-scores">
        {#each finalScores as score (score.key)}
            <text x={score.at.x} y={score.at.y} dy="0.42em" text-anchor="middle" fill={score.color}
                >{score.total}</text
            >
        {/each}
    </g>

    <g class="recent">
        {#each coloredMarks as { key, at, onRoof, color } (key)}
            {#if at}
                <circle
                    class="recent-dot"
                    class:on-roof={onRoof}
                    cx={at.x}
                    cy={at.y}
                    r={RECENT_DOT_RADIUS}
                    fill={color}
                ></circle>
            {/if}
        {/each}
    </g>

    {#if !session.updatingVisibleState}
        <g class="targets">
            {#each session.targets as target (targetKey(target))}
                <polygon
                    class="target"
                    points={targetReach(target)}
                    role="button"
                    tabindex="0"
                    aria-label={targetLabel(target)}
                    onclick={() => place(target)}
                    onkeydown={(event) => onTargetKey(event, target)}
                    onpointerenter={() => (hoveredKey = targetKey(target))}
                    onpointerleave={() => (hoveredKey = undefined)}
                    onfocus={() => (hoveredKey = targetKey(target))}
                    onblur={() => (hoveredKey = undefined)}
                ></polygon>
            {/each}
        </g>
    {/if}
</svg>

<img
    class="preload"
    src={boardArt(
        view === 'plan' ? 'cavalier' : 'plan',
        shown.players.length === 2,
        projection.sideways
    ).url}
    alt=""
/>
<img class="preload" src={sheetUrl('plan')} alt="" />
<img class="preload" src={sheetUrl('cavalier')} alt="" />
<img class="preload" src={sheetUrl('cavalier-shadows')} alt="" />

<style>
    .board {
        display: block;
        user-select: none;
    }

    .preload {
        display: none;
    }

    .board :global(image) {
        pointer-events: none;
    }

    .recent {
        pointer-events: none;
    }

    .board-edge {
        fill: none;
        stroke: #4a2a17;
        pointer-events: none;
    }

    .tile-size {
        pointer-events: none;
        font:
            700 42px/1 'Medina Display',
            Georgia,
            serif;
    }

    .final-scores text {
        pointer-events: none;
        font:
            700 30px/1 'Medina Display',
            Georgia,
            serif;
    }

    .well-bonus {
        fill: rgb(15 74 88 / 0.8);
        pointer-events: none;
        font:
            700 36px/1 'Medina Display',
            Georgia,
            serif;
    }

    .recent-dot {
        stroke: rgb(42 22 9 / 0.55);
        stroke-width: 1.5;
    }

    .recent-dot.on-roof {
        stroke: rgb(42 22 9 / 0.85);
        stroke-width: 2;
    }

    .recent-square {
        opacity: 0.62;
    }

    .piece {
        transition: opacity 140ms;
    }

    .piece.dim {
        opacity: 0.3;
    }

    .shadows {
        transition: opacity 140ms;
    }

    .dimming .shadows,
    .dimming .well-bonuses,
    .dimming .recent-squares,
    .dimming .recent {
        opacity: 0.3;
    }

    .hit {
        fill: transparent;
        pointer-events: all;
        cursor: pointer;
    }

    .target {
        fill: transparent;
        cursor: pointer;
        pointer-events: all;
        outline: none;
    }

    .target-mark {
        fill: rgb(255 243 212 / 0.62);
        stroke: rgb(42 22 9 / 0.72);
        stroke-width: 3;
        pointer-events: none;
    }

    .target-mark.hovered {
        fill: rgb(255 243 212 / 0.95);
    }

    .ghost {
        pointer-events: none;
    }
</style>
