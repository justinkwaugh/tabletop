// PROTOTYPE: compact ship display variants for crowded systems. Throwaway; see PrototypeSwitcher.
import {
    FACTIONS,
    factionShips,
    type Faction,
    type HydratedStellarHorizonsGameState
} from '@tabletop/stellar-horizons-2'

export const SHIP_VARIANTS = [
    { key: 'H', name: 'Orbit clumps, with rings' },
    { key: 'I', name: 'Orbit clumps, no rings' },
    { key: 'J', name: 'Orbit clumps, dark disc' }
] as const

export type ShipVariantKey = (typeof SHIP_VARIANTS)[number]['key']

export interface DisplayShip {
    shipId: string
    faction: Faction
    transit: number
    damage: number
    settlements: number
}

export interface FactionGroup {
    faction: Faction
    ships: DisplayShip[]
}

function variantFromUrl(): ShipVariantKey | undefined {
    if (typeof window === 'undefined') return undefined
    const value = new URL(window.location.href).searchParams.get('variant')
    return SHIP_VARIANTS.find((variant) => variant.key === value)?.key
}

class ShipPrototypeState {
    variant: ShipVariantKey | undefined = $state(variantFromUrl())
    crowd: CrowdMode = $state('typical')
    hover: { systemId: string; faction?: Faction; shipId?: string } | undefined = $state()
    drawerSystemId: string | undefined = $state()

    setVariant(key: ShipVariantKey) {
        this.variant = key
        this.hover = undefined
        this.drawerSystemId = undefined
        const url = new URL(window.location.href)
        url.searchParams.set('variant', key)
        window.history.replaceState(window.history.state, '', url)
    }
}

export const shipPrototype = new ShipPrototypeState()

function hash(text: string): number {
    let value = 2166136261
    for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619)
    return value >>> 0
}

export type CrowdMode = 'off' | 'typical' | 'heavy'

function fakeShip(systemId: string, faction: Faction, shipId: string, cargo: number): DisplayShip {
    const roll = hash(`${systemId}:${shipId}`)
    return {
        shipId,
        faction,
        transit: roll % 4 === 0 ? 1 + (roll % 3) : 0,
        damage: roll % 6 === 1 ? 1 : 0,
        settlements: cargo > 0 && roll % 3 === 2 ? 1 : 0
    }
}

function crowdShips(systemId: string, mode: CrowdMode): DisplayShip[] {
    if (mode === 'off') return []
    const factions = FACTIONS.slice(0, 6).map(({ faction }) => faction)
    const seed = hash(systemId)
    const present =
        mode === 'heavy'
            ? factions
            : seed % 10 < 3
              ? []
              : factions
                    .slice()
                    .sort((a, b) => hash(`${systemId}${a}`) - hash(`${systemId}${b}`))
                    .slice(0, 1 + (seed % 3))
    return present.flatMap((faction) => {
        const roster = factionShips(faction)
        const roll = hash(`${systemId}:${faction}`)
        const count = mode === 'heavy' ? 2 + (roll % 7) : 1 + (roll % 3)
        return Array.from({ length: count }, (_, index) => {
            const ship = roster[(roll + index * 5) % roster.length]
            return fakeShip(systemId, faction, ship.id, ship.cargo)
        })
    })
}

export function factionGroups(
    state: HydratedStellarHorizonsGameState,
    systemId: string,
    crowd: CrowdMode
): FactionGroup[] {
    const real: DisplayShip[] = state.ships.flatMap((ship) => {
        const faction = state.getPlayerState(ship.playerId).faction
        return ship.systemId === systemId && faction ? [{ ...ship, faction }] : []
    })
    const fake = crowdShips(systemId, crowd)
    const all = [
        ...real.filter((ship) => !fake.some((other) => other.shipId === ship.shipId)),
        ...fake
    ]
    return FACTIONS.flatMap(({ faction }) => {
        const factionShipsHere = all.filter((ship) => ship.faction === faction)
        return factionShipsHere.length > 0 ? [{ faction, ships: factionShipsHere }] : []
    })
}
