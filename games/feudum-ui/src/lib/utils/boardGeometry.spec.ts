import { describe, expect, it } from 'vitest'
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
    HaversackStep,
    InventionCell,
    KnightCell,
    KnightSectionHeaderY,
    MarginHeight,
    MarginSlots,
    MarginTop,
    MarketCell,
    MonsterBox,
    PrintedColours,
    RankRadius,
    RosaryPlaces,
    ScoreBand,
    ScoreSpaces,
    ScrollCell,
    ServiceSpaces,
    StackCentres,
    StackSize,
    SunCentre,
    TileChart,
    TileChartRows,
    TrackDiscSize,
    VesselCountStep,
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
    isInside,
    routePointAt,
    spaceGeometry,
    type Point
} from './boardGeometry.js'

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
                ...geometry.goods,
                ...Object.values(geometry.vessels)
            ]
            for (const anchor of anchors) {
                expect(inMap(anchor), id).toBe(true)
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

    it('R-1.2.5 keeps five seats on a space apart and on the space', () => {
        for (const { space, centre, width, height } of ScoreSpaces) {
            const discs = [0, 1, 2, 3, 4].map((lane) => scoreDiscAt(space, lane))
            expect(new Set(discs.map(({ x, y }) => `${x},${y}`)).size).toBe(5)
            for (const disc of discs) {
                expect(Math.abs(disc.x - centre.x)).toBeLessThanOrEqual(ScoreBand / 2)
                expect(Math.abs(disc.y - centre.y)).toBeLessThanOrEqual(ScoreBand / 2)
                expect(width).toBeGreaterThan(0)
                expect(height).toBeGreaterThan(0)
            }
        }
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

    it('R-1.4.2 keeps the margin slots in the margin band, left to right', () => {
        const slots = Object.values(MarginSlots)
        slots.forEach((slot, index) => {
            expect(slot.y).toBeGreaterThan(MarginTop)
            expect(slot.y).toBeLessThan(MarginTop + MarginHeight)
            expect(slot.x).toBeGreaterThan(0)
            expect(slot.x).toBeLessThan(BoardWidth)
            if (index > 0) {
                expect(slot.x).toBeGreaterThan(slots[index - 1].x)
            }
        })
        expect(MarginSlots.haversack.x + HaversackStep * (Goods.length - 1)).toBeLessThan(
            MarginSlots.seals.x
        )
        expect(MarginSlots.vessels.x + VesselCountStep * (VesselTypes.length - 1)).toBeLessThan(
            MarginSlots.targets.x
        )
    })
})
