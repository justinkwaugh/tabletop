import { beforeEach, describe, expect, it, vi } from 'vitest'
import { guildPanelAsset } from '$lib/art/assetMap.js'
import { everyAssetSupplied } from '$lib/testing/fakeArt.js'
import {
    AlchemistCartSpaces,
    AlchemistVesselSpace,
    ChickenSpaces,
    EpicVoyageTrack,
    EpochTrack,
    FarmerBarn,
    FarmerPurse,
    Goods,
    GuildIds,
    GuildRanks,
    GuildTrackSpaces,
    Inventions,
    KnightMonsterIcons,
    KnightRowSections,
    KnightSections,
    MarketSpaces,
    MilitaryServiceTrack,
    RegionIds,
    RegionTileChart,
    Regions,
    RouteMedia,
    Routes,
    ScoreTrack,
    ScrollSpaces,
    Spaces,
    StartingSpaceIds,
    VesselTypes,
    WineBarrelCapacity
} from '@tabletop/feudum'
import {
    BarnBox,
    BarnStackStep,
    BarrelCentres,
    BarrelSulfur,
    BoardHeight,
    SupplyCorner,
    BoardWidth,
    CartCell,
    CofferBox,
    CrestCentre,
    DieCentre,
    DieSize,
    EpochRayMarks,
    EpochRays,
    GuildAreaHeight,
    GuildAreaWidth,
    GuildAreas,
    GuildBox,
    GuildSizes,
    GuildSlots,
    GoodsShownSingly,
    InventionCell,
    KnightCell,
    KnightSectionHeaderY,
    MarketCell,
    MonsterBox,
    PrintedColours,
    RankRadius,
    RosaryPlaces,
    ScoreBand,
    ScoreDiscSize,
    ScoreSpaces,
    ScrollCell,
    ServiceSpaces,
    StackCentres,
    StackSize,
    SunCentre,
    TileChart,
    TileChartRows,
    TrackDiscSize,
    VesselSpaceBox,
    VoyageSpaces,
    barnColumn,
    barrelCentre,
    guildSlot,
    knightCell,
    rosaryBead,
    scoreDiscAt,
    trackPlace,
    vesselForSale,
    MapArea,
    PieceSlotCount,
    RegionOutlines,
    RouteControls,
    RoutePaths,
    SideBySideSpacing,
    SpaceCentres,
    GoodSize,
    plateBox,
    plateSlot,
    DiscFrame,
    LandscapeSize,
    MarkerSize,
    PawnSize,
    VesselSize,
    isInside,
    routePointAt,
    spaceGeometry,
    type Point,
    barnColumnBox,
    barnTokenAt,
    guildPrinted,
    knightRowBox,
    knightRowLabel,
    marketBinBox,
    monsterIconMarker,
    reeveOffset,
    scrollBox,
    vesselForSaleBox,
    vesselForSaleSize,
    type GuildBoxRect
} from './boardGeometry.js'
import {
    PrintedBarnStackStep,
    PrintedCounts,
    PrintedGuildSlots,
    PrintedKnightCell,
    PrintedSizes
} from './printedGuilds.js'

const folder = vi.hoisted(() => {
    const files: Record<string, string> = {}
    return { files }
})
vi.mock('$lib/art/suppliedFiles.js', () => ({
    get suppliedFiles() {
        return folder.files
    }
}))

beforeEach(() => {
    folder.files = {}
})

function distance(a: Point, b: Point) {
    return Math.hypot(a.x - b.x, a.y - b.y)
}

function inMap({ x, y }: Point) {
    return (
        x >= MapArea.x &&
        x <= MapArea.x + MapArea.width &&
        y >= MapArea.y &&
        y <= MapArea.y + MapArea.height
    )
}

describe('the map geometry against the logic data (S72)', () => {
    it('R-1.2.1 places every space, and no space the data lacks', () => {
        expect(Object.keys(SpaceCentres).toSorted()).toEqual(Spaces.map(({ id }) => id).toSorted())
    })

    it('R-1.2.2 places every route, and no route the data lacks', () => {
        expect(Object.keys(RouteControls).toSorted()).toEqual(Routes.map(({ id }) => id).toSorted())
        expect([...RoutePaths.keys()].toSorted()).toEqual(Routes.map(({ id }) => id).toSorted())
    })

    it('R-1.2.1 keeps each space inside its own region', () => {
        for (const space of Spaces) {
            const inRegion = RegionOutlines[space.region].some((outline) =>
                isInside(SpaceCentres[space.id], outline)
            )
            expect(inRegion, space.id).toBe(true)
        }
    })

    it('R-1.2.1 keeps each region drawn', () => {
        for (const region of RegionIds) {
            expect(RegionOutlines[region].length, region).toBeGreaterThan(0)
        }
        expect(Regions.length).toBe(RegionIds.length)
    })
})

describe('the piece slots (S72)', () => {
    it('R-4.1 gives each space four slots, a chip and a place for each thing on it, all on the map', () => {
        for (const { id } of Spaces) {
            const geometry = spaceGeometry(id)
            expect(geometry.pieceSlots).toHaveLength(PieceSlotCount)
            const anchors = [
                geometry.centre,
                ...geometry.pieceSlots,
                geometry.countChip,
                geometry.ruler,
                geometry.subject,
                geometry.serf,
                geometry.landscape,
                ...Goods.map((_, index) => plateSlot(geometry.plate, index)),
                ...Object.values(geometry.vessels)
            ]
            for (const anchor of anchors) {
                expect(inMap(anchor), id).toBe(true)
            }
        }
    })

    it('R-1.1 sets the goods plate below the disc, its slots apart, clear of the markers, landscape and pawns even with every kind on it', () => {
        for (const { id } of Spaces) {
            const geometry = spaceGeometry(id)
            const plate = plateBox(geometry.plate, Goods.length)
            expect(plate.y, id).toBeGreaterThan(geometry.centre.y)
            const pieces = [
                ...geometry.pieceSlots.map((at) => ({ at, size: PawnSize })),
                ...[geometry.ruler, geometry.subject, geometry.serf].map((at) => ({
                    at,
                    size: MarkerSize
                })),
                { at: geometry.landscape, size: LandscapeSize }
            ]
            for (const { at, size } of pieces) {
                const clear =
                    at.x + size / 2 <= plate.x ||
                    at.x - size / 2 >= plate.x + plate.width ||
                    at.y + size / 2 <= plate.y ||
                    at.y - size / 2 >= plate.y + plate.height
                expect(clear, id).toBe(true)
            }
            for (const index of Goods.keys()) {
                if (index > 0) {
                    expect(
                        distance(
                            plateSlot(geometry.plate, index),
                            plateSlot(geometry.plate, index - 1)
                        ),
                        id
                    ).toBeGreaterThanOrEqual(GoodSize)
                }
            }
        }
    })

    it('R-4.1 stands the pawns in an arc above the disc, clear of it', () => {
        for (const { id } of Spaces) {
            const { centre, pieceSlots } = spaceGeometry(id)
            for (const slot of pieceSlots) {
                expect(slot.y, id).toBeLessThan(centre.y)
                expect(distance(slot, centre), id).toBeGreaterThanOrEqual(
                    DiscFrame / 2 + PawnSize / 2
                )
            }
        }
    })

    it('R-4.1.2 sets the markers below the disc on one side, clear of it', () => {
        for (const { id } of Spaces) {
            const { centre, ruler, subject, serf } = spaceGeometry(id)
            const sides = new Set([ruler, subject, serf].map(({ x }) => Math.sign(x - centre.x)))
            expect(sides.size, id).toBe(1)
            expect(sides.has(0), id).toBe(false)
            for (const marker of [ruler, subject, serf]) {
                expect(marker.y, id).toBeGreaterThan(centre.y)
                expect(distance(marker, centre), id).toBeGreaterThanOrEqual(
                    DiscFrame / 2 + MarkerSize / 2
                )
            }
        }
    })

    it('R-4.1 keeps the pawns, markers, landscape and vessels of a space from covering each other', () => {
        const box = (at: Point, size: number) => ({ at, half: size / 2 })
        const overlaps = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) =>
            Math.abs(a.at.x - b.at.x) < a.half + b.half &&
            Math.abs(a.at.y - b.at.y) < a.half + b.half
        for (const { id } of Spaces) {
            const geometry = spaceGeometry(id)
            const kinds = [
                geometry.pieceSlots.map((slot) => box(slot, PawnSize)),
                [geometry.ruler, geometry.subject, geometry.serf].map((at) => box(at, MarkerSize)),
                [box(geometry.landscape, LandscapeSize)],
                Object.values(geometry.vessels).map((at) => box(at, VesselSize))
            ]
            for (const [index, kind] of kinds.entries()) {
                for (const other of kinds.slice(index + 1).flat()) {
                    for (const piece of kind) {
                        expect(overlaps(piece, other), id).toBe(false)
                    }
                }
            }
        }
    })

    it('R-4.1 keeps the four slots of a space apart', () => {
        for (const { id } of Spaces) {
            const { pieceSlots } = spaceGeometry(id)
            for (const [index, slot] of pieceSlots.entries()) {
                for (const other of pieceSlots.slice(index + 1)) {
                    expect(distance(slot, other), id).toBeGreaterThan(20)
                }
            }
        }
    })
})

describe('the routes (S72)', () => {
    it('R-1.2.2 ends each route on its two spaces', () => {
        for (const route of Routes) {
            const path = RoutePaths.get(route.id)
            if (!path) {
                throw new Error(route.id)
            }
            const { a, b } = route
            const tolerance = 2 * SideBySideSpacing
            expect(distance(path.from, SpaceCentres[a]), route.id).toBeLessThanOrEqual(tolerance)
            expect(distance(path.to, SpaceCentres[b]), route.id).toBeLessThanOrEqual(tolerance)
        }
    })

    it('R-1.2.2 keeps two media on one pair apart, side by side', () => {
        const pairs = Map.groupBy(Routes, ({ a, b }) => `${a}--${b}`)
        const doubled = [...pairs.values()].filter((routes) => routes.length > 1)
        expect(doubled.length).toBeGreaterThan(0)
        for (const routes of doubled) {
            const middles = routes.flatMap(({ id }) => {
                const path = RoutePaths.get(id)
                return path ? [routePointAt(path, 0.5)] : []
            })
            expect(middles).toHaveLength(routes.length)
            for (const [index, middle] of middles.entries()) {
                for (const other of middles.slice(index + 1)) {
                    expect(distance(middle, other)).toBeGreaterThanOrEqual(SideBySideSpacing - 0.01)
                }
            }
        }
    })

    it('R-1.2.2 uses each medium on the map', () => {
        expect(new Set(Routes.map(({ medium }) => medium))).toEqual(new Set(RouteMedia))
    })

    it('R-4.2 marks each starting space among the placed spaces', () => {
        for (const id of StartingSpaceIds) {
            expect(SpaceCentres[id]).toBeDefined()
        }
    })
})

function within(point: Point, box: { width: number; height: number }, margin = 0) {
    return (
        point.x >= margin &&
        point.x <= box.width - margin &&
        point.y >= margin &&
        point.y <= box.height - margin
    )
}

describe('The guild areas: every grid space and part has a place (S72, R-1.3)', () => {
    const DataIds = [
        ...GuildTrackSpaces.map(({ id }) => id),
        ...MarketSpaces.map(({ id }) => id),
        ...AlchemistCartSpaces.map(({ id }) => id),
        AlchemistVesselSpace.id,
        ...Inventions.map(({ id }) => id),
        ...KnightRowSections.map(({ id }) => id),
        ...KnightMonsterIcons.map(({ id }) => id),
        ...ScrollSpaces.map(({ id }) => id),
        FarmerBarn.id,
        FarmerPurse.id,
        ...ChickenSpaces.map(({ id }) => id)
    ]

    it('R-1.3 places exactly what the data names, and the two parts with no data id', () => {
        expect(new Set(GuildSlots.keys())).toEqual(
            new Set([...DataIds, 'guild.monk.rosary', 'guild.monk.coffer'])
        )
        expect(GuildSlots.size).toBe(DataIds.length + 2)
    })

    it('R-1.3 keeps every place inside its guild box', () => {
        for (const [id, slot] of GuildSlots) {
            expect(within(slot, GuildBox), id).toBe(true)
        }
    })

    it('R-1.3 gives a guild its three ranks apart, inside the box', () => {
        for (const guild of GuildIds) {
            const ranks = GuildTrackSpaces.filter((space) => space.guild === guild).map(({ id }) =>
                guildSlot(id)
            )
            expect(ranks).toHaveLength(GuildRanks.length)
            ranks.forEach((rank, index) => {
                expect(within(rank, GuildBox, RankRadius - 1)).toBe(true)
                for (const other of ranks.slice(index + 1)) {
                    expect(distance(rank, other)).toBeGreaterThan(RankRadius * 2)
                }
            })
        }
    })

    it('R-1.3 keeps a market cell clear of every other cell', () => {
        MarketSpaces.forEach((space, index) => {
            for (const other of MarketSpaces.slice(index + 1)) {
                const [a, b] = [guildSlot(space.id), guildSlot(other.id)]
                const apart =
                    Math.abs(a.x - b.x) >= MarketCell.width ||
                    Math.abs(a.y - b.y) >= MarketCell.height
                expect(apart, `${space.id} ${other.id}`).toBe(true)
            }
            const { x, y } = guildSlot(space.id)
            expect(x - MarketCell.tokenOffset + MarketCell.width).toBeLessThanOrEqual(
                GuildBox.width
            )
            expect(y + MarketCell.height / 2).toBeLessThanOrEqual(GuildBox.height)
        })
    })

    it('R-1.3 keeps a cart cell clear of the other carts and of the vessels for sale', () => {
        AlchemistCartSpaces.forEach((space, index) => {
            const at = guildSlot(space.id)
            expect(at.x + CartCell.width / 2).toBeLessThanOrEqual(VesselSpaceBox.x)
            for (const other of AlchemistCartSpaces.slice(index + 1)) {
                const there = guildSlot(other.id)
                expect(
                    Math.abs(at.x - there.x) >= CartCell.width ||
                        Math.abs(at.y - there.y) >= CartCell.height
                ).toBe(true)
            }
        })
    })

    it('R-4.5.3 places a vessel for sale of each type inside the vessel space, apart', () => {
        const places = VesselTypes.map(vesselForSale)
        places.forEach((place, index) => {
            expect(place.x - GuildSizes.vessel / 2).toBeGreaterThanOrEqual(VesselSpaceBox.x)
            expect(place.x + GuildSizes.vessel / 2).toBeLessThanOrEqual(
                VesselSpaceBox.x + VesselSpaceBox.width
            )
            for (const other of places.slice(index + 1)) {
                expect(distance(place, other)).toBeGreaterThanOrEqual(GuildSizes.vessel)
            }
        })
    })

    it('R-4.6.5 gives each invention its cell, clear of the vessel space and the others', () => {
        Inventions.forEach(({ id }, index) => {
            const at = guildSlot(id)
            expect(at.y - InventionCell.height / 2).toBeGreaterThanOrEqual(
                VesselSpaceBox.y + VesselSpaceBox.height
            )
            expect(at.y + InventionCell.height / 2).toBeLessThanOrEqual(GuildBox.height)
            for (const other of Inventions.slice(index + 1)) {
                const there = guildSlot(other.id)
                expect(
                    Math.abs(at.x - there.x) >= InventionCell.width ||
                        Math.abs(at.y - there.y) >= InventionCell.height
                ).toBe(true)
            }
        })
    })

    it('R-1.3 gives every printed colour a Knight row of cells, clear of the monster icons', () => {
        const columns = KnightSections.flatMap(({ firstColumn, lastColumn }) =>
            Array.from({ length: lastColumn - firstColumn + 1 }, (_, index) => firstColumn + index)
        )
        const cells = PrintedColours.flatMap((colour) =>
            columns.map((column) => knightCell(colour, column))
        )
        expect(new Set(cells.map(({ x, y }) => `${x},${y}`)).size).toBe(cells.length)
        const monsterEdge = Math.min(
            ...KnightMonsterIcons.map(({ id }) => guildSlot(id).x - MonsterBox.width / 2)
        )
        for (const cell of cells) {
            expect(cell.x + KnightCell / 2).toBeLessThanOrEqual(monsterEdge)
            expect(cell.y + KnightCell / 2).toBeLessThanOrEqual(GuildBox.height)
            expect(cell.y - KnightCell / 2).toBeGreaterThan(KnightSectionHeaderY)
        }
    })

    it('R-5-H1 keeps each scroll clear of the others, with room for its seal', () => {
        ScrollSpaces.forEach(({ id }, index) => {
            const at = guildSlot(id)
            expect(at.x + ScrollCell.width / 2).toBeLessThanOrEqual(GuildBox.width)
            expect(at.y + ScrollCell.height / 2).toBeLessThanOrEqual(GuildBox.height)
            expect(ScrollCell.height).toBeGreaterThanOrEqual(GuildSizes.seal)
            for (const other of ScrollSpaces.slice(index + 1)) {
                const there = guildSlot(other.id)
                expect(
                    Math.abs(at.x - there.x) >= ScrollCell.width ||
                        Math.abs(at.y - there.y) >= ScrollCell.height
                ).toBe(true)
            }
        })
    })

    it('R-1.3 has a column for every good in the barn, and room for its stack', () => {
        const columns = Goods.map(barnColumn)
        expect(new Set(columns.map(({ x }) => x)).size).toBe(Goods.length)
        for (const column of columns) {
            expect(column.x - GuildSizes.good / 2).toBeGreaterThanOrEqual(BarnBox.x)
            expect(column.x + GuildSizes.good / 2).toBeLessThanOrEqual(BarnBox.x + BarnBox.width)
            expect(column.y + (GoodsShownSingly - 1) * BarnStackStep).toBeLessThanOrEqual(
                BarnBox.y + BarnBox.height
            )
        }
    })

    it('R-1.4-H3 has a place for every bead of the box on the rosary, clear of the coffer', () => {
        const beads = Array.from({ length: RosaryPlaces }, (_, index) => rosaryBead(index))
        beads.forEach((bead, index) => {
            expect(bead.x + GuildSizes.bead / 2).toBeLessThanOrEqual(CofferBox.x)
            expect(bead.y - GuildSizes.bead / 2).toBeGreaterThan(CrestCentre.y)
            expect(bead.y + GuildSizes.bead / 2).toBeLessThanOrEqual(GuildBox.height)
            for (const other of beads.slice(index + 1)) {
                expect(distance(bead, other)).toBeGreaterThanOrEqual(GuildSizes.bead)
            }
        })
    })

    it('R-1.2.3 stands the six areas apart in the columns beside the map', () => {
        const areas = GuildIds.map((guild) => GuildAreas[guild])
        areas.forEach((area, index) => {
            const outside =
                area.x + GuildAreaWidth <= MapArea.x || area.x >= MapArea.x + MapArea.width
            expect(outside).toBe(true)
            expect(area.y).toBeGreaterThanOrEqual(ScoreBand)
            expect(area.y + GuildAreaHeight).toBeLessThanOrEqual(BoardHeight - ScoreBand)
            for (const other of areas.slice(index + 1)) {
                expect(
                    Math.abs(area.x - other.x) >= GuildAreaWidth ||
                        Math.abs(area.y - other.y) >= GuildAreaHeight
                ).toBe(true)
            }
        })
    })
})

describe('The tracks and margin: every space has a place (S72)', () => {
    it("R-1.2.5 has the 150 score spaces in order round the edge, with the print's corners", () => {
        expect(ScoreSpaces.map(({ space }) => space)).toEqual(
            Array.from({ length: ScoreTrack.spaces }, (_, index) => ScoreTrack.lowest + index)
        )
        const corners = ScoreSpaces.filter(({ corner }) => corner).map(({ space }) => space)
        expect(corners).toEqual([0, 20, 75, 95])
        const at = (space: number) => ScoreSpaces[space].centre
        expect(at(0).x).toBeLessThan(at(95).x)
        expect(at(0).y).toBeGreaterThan(at(20).y)
        expect(at(20).x).toBeLessThan(at(75).x)
        expect(at(75).y).toBeLessThan(at(95).y)
    })

    it('R-1.2.5 keeps each score space on the band, clear of its neighbour', () => {
        ScoreSpaces.forEach(({ centre, width, height }, index) => {
            expect(centre.x - width / 2).toBeGreaterThanOrEqual(0)
            expect(centre.x + width / 2).toBeLessThanOrEqual(BoardWidth)
            expect(centre.y - height / 2).toBeGreaterThanOrEqual(0)
            expect(centre.y + height / 2).toBeLessThanOrEqual(BoardHeight)
            const next = ScoreSpaces[(index + 1) % ScoreSpaces.length]
            const clear =
                Math.abs(centre.x - next.centre.x) >= (width + next.width) / 2 - 0.01 ||
                Math.abs(centre.y - next.centre.y) >= (height + next.height) / 2 - 0.01
            expect(clear, `${index}`).toBe(true)
            const onBand =
                centre.x <= ScoreBand ||
                centre.x >= BoardWidth - ScoreBand ||
                centre.y <= ScoreBand ||
                centre.y >= BoardHeight - ScoreBand
            expect(onBand).toBe(true)
        })
    })

    it('R-1.2.5 a lone disc stands on its space, and discs sharing one fan along the track by half a disc', () => {
        for (const { space, centre, side, corner } of ScoreSpaces) {
            expect(scoreDiscAt(space)).toEqual(centre)
            for (const count of [2, 3, 4, 5]) {
                const discs = Array.from({ length: count }, (_, index) =>
                    scoreDiscAt(space, index, count)
                )
                const upright = side === 'left' || side === 'right'
                for (const [index, disc] of discs.entries()) {
                    expect(upright ? disc.x : disc.y).toBeCloseTo(upright ? centre.x : centre.y)
                    if (index > 0) {
                        const step = Math.hypot(
                            disc.x - discs[index - 1].x,
                            disc.y - discs[index - 1].y
                        )
                        expect(step).toBeCloseTo(ScoreDiscSize / 2)
                    }
                    expect(disc.x - ScoreDiscSize / 2).toBeGreaterThanOrEqual(0)
                    expect(disc.y - ScoreDiscSize / 2).toBeGreaterThanOrEqual(0)
                    expect(disc.x + ScoreDiscSize / 2).toBeLessThanOrEqual(BoardWidth)
                    expect(disc.y + ScoreDiscSize / 2).toBeLessThanOrEqual(BoardHeight)
                }
                if (corner) {
                    expect(discs[0]).toEqual(centre)
                } else {
                    const middle = discs.reduce(
                        (sum, { x, y }) => ({ x: sum.x + x / count, y: sum.y + y / count }),
                        { x: 0, y: 0 }
                    )
                    expect(middle.x).toBeCloseTo(centre.x)
                    expect(middle.y).toBeCloseTo(centre.y)
                }
            }
        }
    })

    it('R-1.2.5 a disc fills the band', () => {
        expect(ScoreDiscSize).toBeLessThanOrEqual(ScoreBand)
        expect(ScoreDiscSize).toBeGreaterThanOrEqual(ScoreBand * 0.6)
    })

    it('R-3.7.5 places every epic voyage space inside the map, apart', () => {
        expect([...VoyageSpaces.keys()]).toEqual(EpicVoyageTrack.map(({ id }) => id))
        const spaces = EpicVoyageTrack.map(({ id }) => trackPlace(VoyageSpaces, id))
        spaces.forEach((space, index) => {
            expect(inMap(space)).toBe(true)
            if (index > 0) {
                expect(distance(space, spaces[index - 1])).toBeGreaterThan(TrackDiscSize)
            }
        })
    })

    it('R-4.9-H2 places every military service space inside the map, apart', () => {
        expect([...ServiceSpaces.keys()]).toEqual(MilitaryServiceTrack.map(({ id }) => id))
        const spaces = MilitaryServiceTrack.map(({ id }) => trackPlace(ServiceSpaces, id))
        spaces.forEach((space, index) => {
            expect(inMap(space)).toBe(true)
            if (index > 0) {
                expect(distance(space, spaces[index - 1])).toBeGreaterThan(TrackDiscSize)
            }
        })
    })

    it('R-4.11 places every sunray and its marks in the sky', () => {
        expect([...EpochRays.keys()]).toEqual(EpochTrack.map(({ id }) => id))
        expect([...EpochRayMarks.keys()]).toEqual(EpochTrack.map(({ id }) => id))
        for (const { id } of EpochTrack) {
            expect(inMap(trackPlace(EpochRays, id))).toBe(true)
            expect(trackPlace(EpochRays, id).y).toBeLessThan(SunCentre.y)
            expect(trackPlace(EpochRayMarks, id).y).toBeLessThan(SunCentre.y)
        }
    })

    it('R-4.3.2 places every chart row in the chart, in the tile order', () => {
        expect([...TileChartRows.keys()]).toEqual(RegionTileChart.map(({ id }) => id))
        const rows = RegionTileChart.map(({ id }) => trackPlace(TileChartRows, id))
        rows.forEach((row, index) => {
            expect(row.y).toBeGreaterThan(TileChart.y)
            expect(row.y).toBeLessThan(TileChart.y + TileChart.height)
            if (index > 0) {
                expect(row.y).toBeGreaterThan(rows[index - 1].y)
            }
        })
    })

    it('R-4.3.1 places all six stacks and the die clear of each other, on the strip', () => {
        const places = RegionIds.map((region) => StackCentres[region])
        places.forEach((place, index) => {
            expect(inMap(place)).toBe(true)
            expect(place.y + StackSize / 2).toBeLessThanOrEqual(MapArea.y + MapArea.height)
            for (const other of places.slice(index + 1)) {
                expect(Math.abs(place.x - other.x)).toBeGreaterThanOrEqual(StackSize)
            }
            expect(Math.abs(place.x - DieCentre.x)).toBeGreaterThan((StackSize + DieSize) / 2)
        })
    })

    it('R-4.10.2 has a barrel for each printed colour, with room for three sulfur', () => {
        expect(new Set(PrintedColours.map((colour) => barrelCentre(colour))).size).toBe(
            PrintedColours.length
        )
        expect(new Set(Object.keys(BarrelCentres))).toEqual(new Set(PrintedColours))
        expect(BarrelSulfur).toHaveLength(WineBarrelCapacity)
        for (const colour of PrintedColours) {
            expect(inMap(barrelCentre(colour))).toBe(true)
        }
    })

    it("Contract, Supply: the general supply's flights end at the board's lower-left corner, inside the board", () => {
        expect(SupplyCorner.x).toBeGreaterThan(0)
        expect(SupplyCorner.x).toBeLessThan(BoardWidth / 10)
        expect(SupplyCorner.y).toBeLessThan(BoardHeight)
        expect(SupplyCorner.y).toBeGreaterThan(BoardHeight * 0.9)
    })
})

function overlaps(a: GuildBoxRect, b: GuildBoxRect) {
    return (
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
    )
}

function apart(boxes: readonly GuildBoxRect[]) {
    boxes.forEach((box, index) => {
        for (const other of boxes.slice(index + 1)) {
            expect(overlaps(box, other), JSON.stringify([box, other])).toBe(false)
        }
    })
}

function insideBox(box: GuildBoxRect) {
    return (
        box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= GuildBox.width &&
        box.y + box.height <= GuildBox.height
    )
}

describe('On the printed panels, every part stands on its printed space (R-1.3)', () => {
    beforeEach(() => {
        folder.files = everyAssetSupplied()
    })

    it('R-1.3 places the same ids the drawn areas place', () => {
        expect(new Set(PrintedGuildSlots.keys())).toEqual(new Set(GuildSlots.keys()))
    })

    it('R-1.3 reads a slot from the print only for a guild whose panel is in the folder', () => {
        folder.files = { [`./supplied/${guildPanelAsset('knight')}.webp`]: '/art/knight.webp' }
        expect(guildPrinted('knight')).toBe(true)
        expect(guildPrinted('monk')).toBe(false)
        const knight = GuildTrackSpaces.find((space) => space.guild === 'knight')!
        const monk = GuildTrackSpaces.find((space) => space.guild === 'monk')!
        expect(guildSlot(knight.id)).toEqual(PrintedGuildSlots.get(knight.id))
        expect(guildSlot(monk.id)).toEqual(GuildSlots.get(monk.id))
    })

    it('R-1.3 keeps every printed place inside its panel', () => {
        for (const [id, slot] of PrintedGuildSlots) {
            expect(within(slot, GuildBox, 10), id).toBe(true)
        }
    })

    it('R-1.3 gives a guild its three printed ranks apart', () => {
        for (const guild of GuildIds) {
            const ranks = GuildTrackSpaces.filter((space) => space.guild === guild).map(({ id }) =>
                guildSlot(id)
            )
            ranks.forEach((rank, index) => {
                for (const other of ranks.slice(index + 1)) {
                    expect(distance(rank, other)).toBeGreaterThanOrEqual(GuildSizes.marker)
                }
            })
        }
    })

    it('R-1.3 stands a reeve beside its marker, on the panel', () => {
        for (const space of GuildTrackSpaces) {
            const slot = guildSlot(space.id)
            const offset = reeveOffset(space.guild)
            const reeve = { x: slot.x + offset.x, y: slot.y + offset.y }
            expect(distance(slot, reeve)).toBeGreaterThanOrEqual(
                (GuildSizes.marker + GuildSizes.reeve) / 2
            )
            expect(within(reeve, GuildBox, 10)).toBe(true)
        }
    })

    it('R-1.3 keeps the market bins, Knight cells, scrolls and inventions each on its own space', () => {
        const groups = [
            MarketSpaces.map(({ id }) => guildSlot(id)),
            KnightRowSections.map(({ colour, firstColumn, lastColumn }) =>
                Array.from({ length: lastColumn - firstColumn + 1 }, (_, index) =>
                    knightCell(colour, firstColumn + index)
                )
            ).flat(),
            ScrollSpaces.map(({ id }) => guildSlot(id)),
            Inventions.map(({ id }) => guildSlot(id)),
            AlchemistCartSpaces.map(({ id }) => guildSlot(id))
        ]
        for (const places of groups) {
            places.forEach((place, index) => {
                for (const other of places.slice(index + 1)) {
                    expect(distance(place, other)).toBeGreaterThanOrEqual(PrintedSizes.cartGood)
                }
            })
        }
        expect(PrintedKnightCell).toBeGreaterThanOrEqual(PrintedSizes.knightMarker)
    })

    it('R-1.4-H3 strings every bead the box holds, none on another, all on the panel', () => {
        const beads = Array.from({ length: RosaryPlaces }, (_, index) => rosaryBead(index))
        beads.forEach((bead, index) => {
            expect(within(bead, GuildBox, 10)).toBe(true)
            for (const other of beads.slice(index + 1)) {
                expect(distance(bead, other)).toBeGreaterThanOrEqual(GuildSizes.good)
            }
        })
    })

    it('R-4.5.3 stacks the three vessels for sale in the printed glass box, apart', () => {
        const presses = VesselTypes.map((vessel) => vesselForSaleBox(vessel))
        expect(vesselForSaleSize()).toBe(presses[0].width)
        presses.forEach((press) => expect(insideBox(press)).toBe(true))
        apart(presses)
    })

    it('R-4.1 stacks the barn on the farmyard, one column per good, each token apart', () => {
        for (const good of Goods) {
            const column = barnColumnBox(good)
            expect(insideBox(column)).toBe(true)
            for (let index = 0; index < GoodsShownSingly; index++) {
                const token = barnTokenAt(good, index)
                expect(token.y - (index > 0 ? barnTokenAt(good, index - 1).y : token.y)).toBe(
                    index > 0 ? PrintedBarnStackStep : 0
                )
                expect(token.y + GuildSizes.good / 2).toBeLessThanOrEqual(column.y + column.height)
                expect(token.x).toBe(column.x + column.width / 2)
            }
        }
        apart(Goods.map((good) => barnColumnBox(good)))
    })

    it('the bench presses on the print lie on the panel and never on one another', () => {
        const groups = [
            Goods.map((good) => marketBinBox(good)),
            PrintedColours.map((colour) => knightRowBox(colour)),
            ScrollSpaces.map(({ id }) => scrollBox(id))
        ]
        for (const boxes of groups) {
            boxes.forEach((box) => expect(insideBox(box), JSON.stringify(box)).toBe(true))
            apart(boxes)
        }
        for (const colour of PrintedColours) {
            const row = knightRowBox(colour)
            const label = knightRowLabel(colour)
            expect(label.y).toBeLessThan(row.y + row.height)
            expect(label.y).toBeGreaterThan(row.y)
        }
    })

    it("R-4.2.4 puts a monster icon's controller beside the printed beast", () => {
        for (const { id } of KnightMonsterIcons) {
            const marker = monsterIconMarker(id)
            expect(within(marker, GuildBox, 10)).toBe(true)
            expect(distance(marker, guildSlot(id))).toBeGreaterThanOrEqual(
                PrintedSizes.knightMarker
            )
        }
    })

    it("puts each count the print cannot say on its panel, clear of the guild's spaces", () => {
        for (const place of Object.values(PrintedCounts)) {
            expect(within(place, GuildBox, 8)).toBe(true)
        }
    })
})
