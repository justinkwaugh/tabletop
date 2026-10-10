import * as Type from 'typebox'

export enum Side {
    French = 'French',
    Allied = 'Allied'
}

export function opposingSide(side: Side): Side {
    return side === Side.French ? Side.Allied : Side.French
}

export enum UnitType {
    Infantry = 'Infantry',
    Cavalry = 'Cavalry',
    Artillery = 'Artillery'
}

export type Face = Type.Static<typeof Face>
export const Face = Type.Object({
    type: Type.Enum(UnitType),
    strength: Type.Integer({ minimum: 1, maximum: 3 }),
    guard: Type.Optional(Type.Literal(true))
})

const ELITE_STRENGTH = 3

export function isGuard(face: Face): boolean {
    return face.guard === true
}

export function isHeavyCavalry(face: Face): boolean {
    return face.type === UnitType.Cavalry && face.strength === ELITE_STRENGTH
}

export function sameFace(a: Face, b: Face): boolean {
    return a.type === b.type && a.strength === b.strength && isGuard(a) === isGuard(b)
}

/** Designer ruling: Guard infantry that takes a loss becomes ordinary infantry. */
export function reducedFace(face: Face, losses: number): Face | undefined {
    const strength = face.strength - losses
    return strength > 0 ? { type: face.type, strength } : undefined
}

function faces(count: number, type: UnitType, strength: number, guard?: true): Face[] {
    return Array.from({ length: count }, () =>
        guard ? { type, strength, guard } : { type, strength }
    )
}

export const STARTING_ARMIES: Record<Side, Face[]> = {
    [Side.French]: [
        ...faces(3, UnitType.Artillery, 1),
        ...faces(5, UnitType.Cavalry, 2),
        ...faces(3, UnitType.Cavalry, 3),
        ...faces(16, UnitType.Infantry, 2),
        ...faces(7, UnitType.Infantry, 3),
        ...faces(2, UnitType.Infantry, 3, true)
    ],
    [Side.Allied]: [
        ...faces(4, UnitType.Artillery, 1),
        ...faces(3, UnitType.Cavalry, 1),
        ...faces(6, UnitType.Cavalry, 2),
        ...faces(2, UnitType.Cavalry, 3),
        ...faces(2, UnitType.Infantry, 1),
        ...faces(19, UnitType.Infantry, 2),
        ...faces(5, UnitType.Infantry, 3),
        ...faces(3, UnitType.Infantry, 3, true)
    ]
}

const UNIT_ID_PREFIX: Record<Side, string> = {
    [Side.French]: 'F',
    [Side.Allied]: 'A'
}

export function unitId(side: Side, index: number): string {
    return `${UNIT_ID_PREFIX[side]}${String(index + 1).padStart(2, '0')}`
}

export const MAX_CORPS_UNITS = 8

export interface CommanderDefinition {
    id: string
    name: string
    side: Side
    minimumUnits: number
    reinforcement?: true
}

function commander(
    id: string,
    name: string,
    side: Side,
    minimumUnits: number,
    reinforcement?: true
): CommanderDefinition {
    return reinforcement
        ? { id, name, side, minimumUnits, reinforcement }
        : { id, name, side, minimumUnits }
}

export const COMMANDERS: readonly CommanderDefinition[] = [
    commander('bernadotte', 'Bernadotte', Side.French, 4, true),
    commander('bessieres', 'Bessières', Side.French, 4),
    commander('davout', 'Davout', Side.French, 4, true),
    commander('lannes', 'Lannes', Side.French, 4),
    commander('legrand', 'Legrand', Side.French, 3),
    commander('murat', 'Murat', Side.French, 4),
    commander('st-hilaire', 'St. Hilaire', Side.French, 3),
    commander('vandamme', 'Vandamme', Side.French, 3),
    commander('bagration', 'Bagration', Side.Allied, 4),
    commander('constantine', 'Constantine', Side.Allied, 4),
    commander('dokhturov', 'Dokhturov', Side.Allied, 4),
    commander('kienmayer', 'Kienmayer', Side.Allied, 3),
    commander('kollowrath', 'Kollowrath', Side.Allied, 3),
    commander('langeron', 'Langeron', Side.Allied, 4),
    commander('liechtenstein', 'Liechtenstein', Side.Allied, 4),
    commander('miloradovich', 'Miloradovich', Side.Allied, 3),
    commander('prebyshevsky', 'Prebyshevsky', Side.Allied, 4)
]

export function commanderDefinition(id: string): CommanderDefinition {
    const definition = COMMANDERS.find((candidate) => candidate.id === id)
    if (!definition) {
        throw Error(`Unknown commander ${id}`)
    }
    return definition
}

export function commandersOf(side: Side): CommanderDefinition[] {
    return COMMANDERS.filter((candidate) => candidate.side === side)
}

export const STARTING_MORALE: Record<Side, number> = {
    [Side.French]: 23,
    [Side.Allied]: 27
}

export const INDEPENDENT_COMMANDS: Record<Side, number> = {
    [Side.French]: 4,
    [Side.Allied]: 3
}

export const ALLIED_CORPS_COMMAND_LIMIT = 5
export const FRENCH_REINFORCEMENT_MORALE = 4
export const HEAVY_CAVALRY_COMMITMENT_PENALTY = 2
export const GUARD_COMMITMENT_PENALTY = 4
export const FAILED_GUARD_ATTACK_PENALTY = 3
