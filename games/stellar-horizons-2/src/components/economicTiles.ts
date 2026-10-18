// Rulebook 4.0: the seven economic phase tiles, one drawn at the start of each campaign turn.
export enum EconomicTile {
    RollInitiative = 'RollInitiative',
    DrawEvent = 'DrawEvent',
    EarthProduction = 'EarthProduction',
    BaseProduction = 'BaseProduction',
    DrawTradeGoods = 'DrawTradeGoods',
    SettlementGrowth = 'SettlementGrowth',
    Terraforming = 'Terraforming'
}

export const ECONOMIC_TILES: readonly EconomicTile[] = [
    EconomicTile.RollInitiative,
    EconomicTile.DrawEvent,
    EconomicTile.EarthProduction,
    EconomicTile.BaseProduction,
    EconomicTile.DrawTradeGoods,
    EconomicTile.SettlementGrowth,
    EconomicTile.Terraforming
]
