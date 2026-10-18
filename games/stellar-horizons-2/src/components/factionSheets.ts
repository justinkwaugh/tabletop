import { Faction } from './factions.js'
import { TechField } from './techFields.js'

// The faction sheets apply only in the campaign (Player Guide 1.0). Values are transcribed from
// the printed mats in the Vassal module; the initial ships from the rulebook's table on page 14.

export interface CenturyRow {
    century: number
    cash: number
    markers: Record<TechField, number>
    maxShips: number
    maxBases: number
    tradeGoods: number
}

export interface InitialShip {
    shipId: string
    systemId: string
    transit: number
}

export interface FactionAbilities {
    baseRangeMultiplier?: number
    anomalyChance?: number
    anomalyDifficulty?: number
    combatAnomalyDifficulty?: number
    extraTerraforms?: number
    habitabilityBonus?: number
    converts?: true
}

export interface FactionSheet {
    faction: Faction
    settlementCost: number
    centuries: readonly CenturyRow[]
    initialShips: readonly InitialShip[]
    abilities: FactionAbilities
}

export const LAST_CENTURY = 2500

type RowValues = [
    cash: number,
    biology: number,
    physics: number,
    engineering: number,
    maxShips: number,
    maxBases: number,
    tradeGoods: number
]

function centuries(...rows: RowValues[]): CenturyRow[] {
    return rows.map(
        ([cash, biology, physics, engineering, maxShips, maxBases, tradeGoods], index) => ({
            century: 2100 + 100 * index,
            cash,
            markers: {
                [TechField.Biology]: biology,
                [TechField.Physics]: physics,
                [TechField.Engineering]: engineering
            },
            maxShips,
            maxBases,
            tradeGoods
        })
    )
}

function ship(shipId: string, systemId: string, transit = 0): InitialShip {
    return { shipId, systemId, transit }
}

export const FACTION_SHEETS: readonly FactionSheet[] = [
    {
        faction: Faction.Consortium,
        settlementCost: 5,
        centuries: centuries(
            [25, 1, 2, 2, 5, 1, 3],
            [27, 2, 2, 3, 5, 2, 4],
            [30, 2, 3, 3, 6, 3, 5],
            [33, 3, 3, 4, 7, 4, 6],
            [35, 3, 4, 4, 7, 5, 7]
        ),
        initialShips: [
            ship('consortium-prospector', 'luhman-16'),
            ship('consortium-prosperity', 'barnards-star'),
            ship('consortium-surveyor', 'wolf-359'),
            ship('consortium-nostromo', 'lalande-21185', 1),
            ship('consortium-sapphire', 'alpha-centauri', 3)
        ],
        abilities: {}
    },
    {
        faction: Faction.Givers,
        settlementCost: 4,
        centuries: centuries(
            [24, 1, 1, 1, 5, 1, 2],
            [26, 2, 1, 2, 6, 3, 3],
            [28, 3, 2, 2, 6, 4, 4],
            [30, 3, 2, 3, 7, 5, 6],
            [30, 4, 3, 3, 8, 6, 6]
        ),
        initialShips: [
            ship('givers-linnaeus', 'wise-0855-0714'),
            ship('givers-mendel', 'wolf-359'),
            ship('givers-humboldt', 'lalande-21185', 1),
            ship('givers-bougainville', 'luhman-16', 2),
            ship('givers-darwin', 'alpha-centauri', 3)
        ],
        abilities: { extraTerraforms: 1 }
    },
    {
        faction: Faction.Praetorians,
        settlementCost: 6,
        centuries: centuries(
            [28, 2, 3, 2, 4, 1, 2],
            [30, 2, 3, 3, 5, 2, 3],
            [32, 3, 3, 3, 6, 3, 4],
            [35, 3, 4, 4, 6, 4, 5],
            [35, 4, 4, 4, 7, 4, 5]
        ),
        initialShips: [
            ship('praetorians-peregrinus', 'luhman-16'),
            ship('praetorians-fidelis', 'wolf-359', 1),
            ship('praetorians-audax', 'wise-0855-0714', 1),
            ship('praetorians-odyssey', 'alpha-centauri', 2)
        ],
        abilities: {}
    },
    {
        faction: Faction.Starfarers,
        settlementCost: 5,
        centuries: centuries(
            [25, 1, 2, 2, 5, 2, 2],
            [27, 1, 2, 2, 6, 3, 3],
            [29, 2, 2, 2, 6, 4, 4],
            [30, 2, 3, 3, 7, 5, 4],
            [30, 3, 4, 3, 7, 5, 5]
        ),
        initialShips: [
            ship('starfarers-kuiper', 'lalande-21185'),
            ship('starfarers-messier', 'barnards-star', 1),
            ship('starfarers-kepler', 'wise-0855-0714', 1),
            ship('starfarers-copernicus', 'luhman-16', 2),
            ship('starfarers-orion', 'alpha-centauri', 2)
        ],
        abilities: { baseRangeMultiplier: 2, anomalyChance: 30, anomalyDifficulty: -1 }
    },
    {
        faction: Faction.Syndicate,
        settlementCost: 4,
        centuries: centuries(
            [23, 1, 1, 2, 5, 1, 2],
            [25, 1, 1, 2, 6, 3, 3],
            [27, 1, 2, 2, 7, 4, 4],
            [29, 2, 2, 2, 7, 5, 5],
            [29, 3, 3, 3, 8, 6, 5]
        ),
        initialShips: [
            ship('syndicate-nomad', 'wise-0855-0714'),
            ship('syndicate-harbinger', 'lalande-21185'),
            ship('syndicate-vagabond', 'wolf-359', 1),
            ship('syndicate-viper', 'barnards-star', 1),
            ship('syndicate-cobra', 'luhman-16', 2)
        ],
        abilities: { combatAnomalyDifficulty: -2 }
    },
    {
        faction: Faction.Transhumanists,
        settlementCost: 5,
        centuries: centuries(
            [25, 3, 2, 2, 5, 1, 2],
            [27, 3, 2, 2, 5, 2, 3],
            [29, 3, 2, 2, 6, 3, 4],
            [31, 4, 3, 3, 7, 4, 5],
            [33, 5, 4, 3, 7, 5, 6]
        ),
        initialShips: [
            ship('transhumanists-hawking', 'barnards-star'),
            ship('transhumanists-foucault', 'lalande-21185', 1),
            ship('transhumanists-franklin', 'wolf-359', 1),
            ship('transhumanists-daedalus', 'alpha-centauri', 2),
            ship('transhumanists-curie', 'luhman-16', 2)
        ],
        abilities: {}
    },
    {
        faction: Faction.TruePath,
        settlementCost: 3,
        centuries: centuries(
            [20, 1, 1, 1, 5, 1, 2],
            [22, 1, 1, 2, 6, 3, 3],
            [24, 2, 1, 2, 7, 4, 3],
            [26, 2, 2, 3, 8, 5, 4],
            [28, 3, 2, 3, 8, 6, 4]
        ),
        initialShips: [
            ship('truepath-lightbringer', 'wise-0855-0714'),
            ship('truepath-faithful', 'lalande-21185'),
            ship('truepath-pathfinder', 'alpha-centauri', 1),
            ship('truepath-ardent-spirit', 'luhman-16', 2),
            ship('truepath-pilgrim', 'barnards-star', 3)
        ],
        abilities: { habitabilityBonus: 20, converts: true }
    }
]

export function factionSheet(faction: Faction): FactionSheet {
    const sheet = FACTION_SHEETS.find((candidate) => candidate.faction === faction)
    if (!sheet) {
        throw new Error(`No faction sheet for ${faction}`)
    }
    return sheet
}

export function centuryOf(year: number): number {
    return Math.min(LAST_CENTURY, Math.floor(year / 100) * 100)
}

export function centuryRow(faction: Faction, year: number): CenturyRow {
    const century = centuryOf(year)
    const row = factionSheet(faction).centuries.find((candidate) => candidate.century === century)
    if (!row) {
        throw new Error(`No ${faction} row for ${century}`)
    }
    return row
}

// The Base Production table, the same on every faction sheet.
export interface BaseProductionRow {
    minSettlements: number
    tradeGoods: number
    cashBonus: number
    techBonus: number
}

export const BASE_PRODUCTION: readonly BaseProductionRow[] = [
    { minSettlements: 1, tradeGoods: 1, cashBonus: 0, techBonus: 0 },
    { minSettlements: 5, tradeGoods: 1, cashBonus: 1, techBonus: 1 },
    { minSettlements: 10, tradeGoods: 2, cashBonus: 2, techBonus: 1 },
    { minSettlements: 15, tradeGoods: 2, cashBonus: 3, techBonus: 2 },
    { minSettlements: 20, tradeGoods: 2, cashBonus: 4, techBonus: 2 },
    { minSettlements: 30, tradeGoods: 3, cashBonus: 5, techBonus: 2 },
    { minSettlements: 40, tradeGoods: 3, cashBonus: 6, techBonus: 2 },
    { minSettlements: 50, tradeGoods: 4, cashBonus: 7, techBonus: 3 }
]

export function baseProductionRow(settlements: number): BaseProductionRow {
    return (
        BASE_PRODUCTION.findLast((row) => settlements >= row.minSettlements) ?? BASE_PRODUCTION[0]
    )
}
