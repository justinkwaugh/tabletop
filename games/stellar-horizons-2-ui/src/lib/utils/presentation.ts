import {
    Faction,
    TechField,
    TechId,
    TurnStep,
    factionDefinition,
    systemDefinition
} from '@tabletop/stellar-horizons-2'

export const STEP_LABELS: Record<TurnStep, string> = {
    [TurnStep.Build]: 'Build & repair',
    [TurnStep.Cargo]: 'Cargo',
    [TurnStep.Movement]: 'Movement',
    [TurnStep.Exploration]: 'Exploration',
    [TurnStep.Development]: 'Develop techs',
    [TurnStep.Done]: 'Done'
}

export const STEP_DONE_LABELS: Record<TurnStep, string> = {
    [TurnStep.Build]: 'Done building',
    [TurnStep.Cargo]: 'Done with cargo',
    [TurnStep.Movement]: 'Done moving',
    [TurnStep.Exploration]: 'Done exploring',
    [TurnStep.Development]: 'End turn',
    [TurnStep.Done]: 'Done'
}

export const FIELD_COLORS: Record<TechField, string> = {
    [TechField.Biology]: '#5fa443',
    [TechField.Physics]: '#2f8fd0',
    [TechField.Engineering]: '#9aa1ab'
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

export function plural(count: number, noun: string, pluralNoun = `${noun}s`): string {
    return `${count} ${count === 1 ? noun : pluralNoun}`
}
