import {
    CASH_PRODUCTION,
    EconomicTile,
    Faction,
    TechField,
    TechId,
    TurnPhase,
    factionDefinition,
    systemDefinition,
    type BaseEffects,
    type Production
} from '@tabletop/stellar-horizons-2'

export const PHASE_LABELS: Record<TurnPhase, string> = {
    [TurnPhase.Build]: 'Build & repair',
    [TurnPhase.Cargo]: 'Cargo',
    [TurnPhase.Movement]: 'Movement',
    [TurnPhase.Exploration]: 'Exploration',
    [TurnPhase.Development]: 'Develop techs',
    [TurnPhase.Initiative]: 'Initiative',
    [TurnPhase.BaseProduction]: 'Base production',
    [TurnPhase.TradeGoods]: 'Trade goods'
}

export const PHASE_DONE_LABELS: Record<TurnPhase, string> = {
    [TurnPhase.Build]: 'Done building',
    [TurnPhase.Cargo]: 'Done with cargo',
    [TurnPhase.Movement]: 'Done moving',
    [TurnPhase.Exploration]: 'Done exploring',
    [TurnPhase.Development]: 'Done developing',
    [TurnPhase.Initiative]: 'Declare',
    [TurnPhase.BaseProduction]: 'Done producing',
    [TurnPhase.TradeGoods]: 'Assign goods'
}

export const PHASE_STARTED: Record<TurnPhase, string> = {
    [TurnPhase.Build]: 'starts building',
    [TurnPhase.Cargo]: 'starts transferring cargo',
    [TurnPhase.Movement]: 'starts moving',
    [TurnPhase.Exploration]: 'starts exploring',
    [TurnPhase.Development]: 'starts developing techs',
    [TurnPhase.Initiative]: 'starts declaring IP for initiative',
    [TurnPhase.BaseProduction]: 'starts choosing base production',
    [TurnPhase.TradeGoods]: 'starts assigning trade goods'
}

export const PHASE_FINISHED: Record<TurnPhase, string> = {
    [TurnPhase.Build]: 'finished building',
    [TurnPhase.Cargo]: 'finished with cargo',
    [TurnPhase.Movement]: 'finished moving',
    [TurnPhase.Exploration]: 'finished exploring',
    [TurnPhase.Development]: 'finished developing techs',
    [TurnPhase.Initiative]: 'declared IP for initiative',
    [TurnPhase.BaseProduction]: 'chose base production',
    [TurnPhase.TradeGoods]: 'assigned trade goods'
}

export const PHASE_SKIPPED: Record<TurnPhase, string> = {
    [TurnPhase.Build]: 'has nothing more to build',
    [TurnPhase.Cargo]: 'has no cargo to move',
    [TurnPhase.Movement]: 'has no ships to move',
    [TurnPhase.Exploration]: 'has nothing to explore',
    [TurnPhase.Development]: 'has no tech to develop',
    [TurnPhase.Initiative]: 'has no IP to declare',
    [TurnPhase.BaseProduction]: 'has no base to produce at',
    [TurnPhase.TradeGoods]: 'drew no trade goods'
}

export const PHASE_OVER: Record<TurnPhase, string> = {
    [TurnPhase.Build]: 'Everyone has finished building.',
    [TurnPhase.Cargo]: 'Cargo transfers are over.',
    [TurnPhase.Movement]: 'Everyone has finished moving.',
    [TurnPhase.Exploration]: 'Everyone has finished exploring.',
    [TurnPhase.Development]: 'Everyone has finished developing techs.',
    [TurnPhase.Initiative]: 'Everyone has declared their IP.',
    [TurnPhase.BaseProduction]: 'Every base has chosen what to produce.',
    [TurnPhase.TradeGoods]: 'Everyone has assigned their trade goods.'
}

export const ECONOMIC_TILE_LABELS: Record<EconomicTile, string> = {
    [EconomicTile.RollInitiative]: 'Roll initiative',
    [EconomicTile.DrawEvent]: 'Draw event',
    [EconomicTile.EarthProduction]: 'Earth production',
    [EconomicTile.BaseProduction]: 'Base production',
    [EconomicTile.DrawTradeGoods]: 'Draw trade goods',
    [EconomicTile.SettlementGrowth]: 'Growth & migration',
    [EconomicTile.Terraforming]: 'Terraforming'
}

// What a base's production yields, as the production panel and history name it.
export function productionLabel(production: Production, amount: number): string {
    return production === CASH_PRODUCTION
        ? `$${amount}B`
        : plural(amount, `${production.toLowerCase()} marker`)
}

// What a turned-over anomaly does to the production of the bases in its system, if anything.
export function backProductionText(effects: BaseEffects): string | undefined {
    const parts = [
        effects.cashProduction ? `+$${effects.cashProduction}B when producing cash` : '',
        effects.markerProduction
            ? `+${plural(
                  effects.markerProduction.count,
                  `${effects.markerProduction.fields.map((field) => field.toLowerCase()).join(' or ')} marker`
              )} when producing ${effects.markerProduction.fields.length > 1 ? 'those' : 'that'}`
            : '',
        effects.settlementsDoubledForProduction ? 'settlements count double' : '',
        effects.settlementLossInProduction
            ? `loses ${plural(effects.settlementLossInProduction, 'settlement')}`
            : '',
        effects.settlementAfterProduction
            ? `gains ${plural(effects.settlementAfterProduction, 'settlement')} afterwards`
            : ''
    ].filter(Boolean)
    return parts.length > 0 ? parts.join('; ') : undefined
}

export const FIELD_COLORS: Record<TechField, string> = {
    [TechField.Biology]: '#5fa443',
    [TechField.Physics]: '#2f8fd0',
    [TechField.Engineering]: '#9aa1ab'
}

export const FIELD_GLOW: Record<TechField, string> = {
    [TechField.Biology]: '#7be08f',
    [TechField.Physics]: '#5ab8ff',
    [TechField.Engineering]: '#c9d1dc'
}

export const FACTION_FILL: Record<Faction, string> = {
    [Faction.Consortium]: '#a8916a',
    [Faction.Givers]: '#5fa443',
    [Faction.Praetorians]: '#8f3f92',
    [Faction.Starfarers]: '#2f8fd0',
    [Faction.Syndicate]: '#c8402f',
    [Faction.Transhumanists]: '#3a3d44',
    [Faction.TruePath]: '#d9b23c'
}

export const FACTION_BLURB: Record<Faction, string> = {
    [Faction.Consortium]: 'Corporate traders with abundant mining ships and large cargo holds.',
    [Faction.Givers]: 'Terraformers spreading nature across the galaxy.',
    [Faction.Praetorians]: 'A private navy with the best combat ships.',
    [Faction.Starfarers]: 'The old space agencies, built for exploration.',
    [Faction.Syndicate]: 'Raiders and smugglers with small, cheap ships.',
    [Faction.Transhumanists]: 'Reshaping humanity to suit other worlds.',
    [Faction.TruePath]: 'A faith seeking answers among the stars.'
}

export function factionName(faction: Faction): string {
    return factionDefinition(faction).name
}

export function systemName(systemId: string): string {
    return systemDefinition(systemId).name
}

export const TECH_EFFECT_TEXT: Record<TechId, string> = {
    [TechId.InterstellarSettlement]: 'Buy settlements on Earth; settle 80%+ habitability',
    [TechId.ImprovedInterstellarExpeditions]: 'CV malfunction 45%',
    [TechId.Terraforming]: 'Terraform once each even decade',
    [TechId.ImprovedInterstellarSettlement]: 'Settle 60%+ habitability',
    [TechId.AdvancedInterstellarExpeditions]: 'CV malfunction 40%',
    [TechId.ImprovedGeneticManipulation]: 'Level II genetic manipulations (campaign)',
    [TechId.AdvancedInterstellarSettlement]: 'Settle 40%+ habitability',
    [TechId.InterstellarLogistics]: 'CV malfunction 35%, CV exploration +1',
    [TechId.AdvancedTerraforming]: 'Draw two worlds when terraforming a II side',
    [TechId.HarshSpaceEnvironment]: 'Settle any system',
    [TechId.ImprovedInterstellarLogistics]: 'CV malfunction 30%, CV exploration +2',
    [TechId.AdvancedGeneticManipulation]: 'Level III genetic manipulations (campaign)',
    [TechId.AdvancedInterstellarLogistics]: 'CV malfunction 25%, CV exploration +3',
    [TechId.AtmosphereProcessing]: 'Mining ships terraform while exploring (campaign)',
    [TechId.Cloning]: 'Buy a settlement at each base for $5B in the build step',
    [TechId.AdvancedLaserPropulsion]: 'RE movement ×2',
    [TechId.LongDistanceProbes]: 'RE range 2',
    [TechId.FusionRockets]: 'CV movement ×4',
    [TechId.UltraLongDistanceProbes]: 'RE range unlimited',
    [TechId.AdvancedFusionRockets]: 'CV movement ×3',
    [TechId.LongDistanceMissions]: 'CV range 2',
    [TechId.MiniaturizedFusionRockets]: 'RE movement ×1',
    [TechId.BussardRamjets]: 'CV movement ×2',
    [TechId.AntimatterRockets]: 'CV movement ×1.5',
    [TechId.UltraLongDistanceMissions]: 'CV range unlimited',
    [TechId.MiniaturizedAntimatterRockets]: 'RE movement ×0.5',
    [TechId.AdvancedAntimatterRockets]: 'CV movement ×1',
    [TechId.TerranExodus]: 'CV malfunction 20%; settlements $1B cheaper',
    [TechId.NearLightSpeeds]: 'CV movement ×0.5',
    [TechId.InterstellarTransports]: 'Build CV-3 ships',
    [TechId.InterstellarComponentDesign]: 'RE malfunction 26%',
    [TechId.OrbitalShipyards]: 'Build CV-4 ships',
    [TechId.ImprovedComponentDesign]: 'RE malfunction 22%',
    [TechId.InterstellarDestroyers]: 'Build CV-5 ships',
    [TechId.StarshipTheoreticalConcepts]: 'Level II fleet improvements (campaign)',
    [TechId.AdvancedComponentDesign]: 'RE malfunction 18%',
    [TechId.InterstellarCruisers]: 'Build CV-6 ships',
    [TechId.QuantumCommunications]: 'RE malfunction 16%, RE exploration +1',
    [TechId.InterstellarBattlecruisers]: 'Build CV-7 ships',
    [TechId.AdvancedTheoreticalConcepts]: 'Level III fleet improvements (campaign)',
    [TechId.ArtificialIntelligence]: 'RE malfunction 14%, RE exploration +2',
    [TechId.InterstellarBattleships]: 'Build CV-8+ ships',
    [TechId.HeavyInterstellarTransport]: 'CV cargo +1 for cargo ships',
    [TechId.RoboticConsciousness]: 'RE malfunction 12%, RE exploration +3'
}

// The chance of a ten-sided die rolling the target or less.
export function rollChance(target: number): string {
    return `${Math.min(Math.max(target, 0), 10) * 10}%`
}

export function plural(count: number, noun: string, pluralNoun = `${noun}s`): string {
    return `${count} ${count === 1 ? noun : pluralNoun}`
}
