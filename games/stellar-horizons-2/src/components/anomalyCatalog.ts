export enum AnomalyChallenge {
    Science = 'Science',
    Combat = 'Combat'
}

export interface AnomalyDefinition {
    id: string
    name: string
    challenge: AnomalyChallenge
    difficulty: number
    noExploration: boolean
    noBases: boolean
}

const S = AnomalyChallenge.Science
const C = AnomalyChallenge.Combat

export const ANOMALIES: readonly AnomalyDefinition[] = [
    anomaly('adorable-critters', 'Adorable Critters', S, 2, false, false),
    anomaly('alien-artifacts', 'Alien Artifacts', S, 7, false, false),
    anomaly('alien-derelict', 'Alien Derelict', S, 9, false, true),
    anomaly('alien-remains', 'Alien Remains', S, 9, false, true),
    anomaly('alien-sentinel', 'Alien Sentinel', C, 15, true, true),
    anomaly('anarchist-outpost', 'Anarchist Outpost', C, 7, true, true),
    anomaly('asteroid-clouds', 'Asteroid Clouds', C, 5, true, true),
    anomaly('colossal-comet', 'Colossal Comet', C, 3, false, false),
    anomaly('decapod-infestation', 'Decapod Infestation', C, 6, false, true),
    anomaly('dissidents', 'Dissidents', C, 7, false, false),
    anomaly('hostile-xenomorphs', 'Hostile Xenomorphs', C, 9, false, true),
    anomaly('ice-caverns', 'Ice Caverns', S, 3, false, false),
    anomaly('medicinal-herbs', 'Medicinal Herbs', S, 4, false, false),
    anomaly('megafauna', 'Megafauna', C, 5, false, true),
    anomaly('mineral-veins', 'Mineral Veins', S, 5, false, false),
    anomaly('nanobot-swarm', 'Nanobot Swarm', C, 8, true, true),
    anomaly('natural-stimulants', 'Natural Stimulants', S, 5, false, false),
    anomaly('pirate-lair', 'Pirate Lair', C, 6, true, true),
    anomaly('predatory-plants', 'Predatory Plants', C, 1, false, true),
    anomaly('primal-carnivores', 'Primal Carnivores', C, 3, false, true),
    anomaly('rare-crystals', 'Rare Crystals', S, 6, false, false),
    anomaly('rescue-scout-ship', 'Rescue Scout Ship', S, 1, true, true),
    anomaly('savage-storms', 'Savage Storms', S, 7, false, true),
    anomaly('severe-radiation', 'Severe Radiation', S, 5, true, true),
    anomaly('shadow-fleet', 'Shadow Fleet', C, 12, true, true),
    anomaly('splinter-colony', 'Splinter Colony', C, 1, true, true),
    anomaly('stellar-chart', 'Stellar Chart', S, 4, false, false),
    anomaly('stellar-flares', 'Stellar Flares', S, 3, true, true),
    anomaly('stunning-vistas', 'Stunning Vistas', S, 3, false, false),
    anomaly('symbiotic-spores', 'Symbiotic Spores', S, 7, false, true),
    anomaly('system-quarantine', 'System Quarantine', S, 9, true, true),
    anomaly('terran-dna', 'Terran DNA', S, 8, false, true),
    anomaly('tunnel-complex', 'Tunnel Complex', S, 4, false, false),
    anomaly('violent-separatists', 'Violent Separatists', C, 8, true, true)
]

function anomaly(
    id: string,
    name: string,
    challenge: AnomalyChallenge,
    difficulty: number,
    noExploration: boolean,
    noBases: boolean
): AnomalyDefinition {
    return { id, name, challenge, difficulty, noExploration, noBases }
}
