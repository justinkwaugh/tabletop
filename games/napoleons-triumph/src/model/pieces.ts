import * as Type from 'typebox'
import { Visibility, assertExists } from '@tabletop/common'
import { Face } from '../components/pieces.js'

/** A place inside a locale: blocking one of its approaches, or in reserve when `approach` is absent. */
export type Position = Type.Static<typeof Position>
export const Position = Type.Object({
    locale: Type.Integer(),
    approach: Type.Optional(Type.Integer())
})

export function samePosition(a: Position | undefined, b: Position | undefined): boolean {
    return (
        a !== undefined &&
        b !== undefined &&
        a.locale === b.locale &&
        a.approach === b.approach
    )
}

export function inReserve(position: Position): boolean {
    return position.approach === undefined
}

export function reserveOf(locale: number): Position {
    return { locale }
}

export type Unit = Type.Static<typeof Unit>
export const Unit = Type.Object({
    id: Type.String(),
    playerId: Type.String(),
    face: Visibility.protect(Face, { policy: Visibility.Policy.Owner }),
    /** The face as the opponent last saw it, kept while they can still tell this block apart. */
    shown: Type.Optional(Face),
    commanderId: Type.Optional(Type.String()),
    /** Absent while the unit is off the map. */
    position: Type.Optional(Position),
    fixed: Type.Optional(Type.Literal(true)),
    movesThisTurn: Type.Optional(Type.Integer({ minimum: 1 })),
    enteredThisTurn: Type.Optional(Type.Literal(true)),
    enteredReserveThisTurn: Type.Optional(Type.Literal(true)),
    defendedApproach: Type.Optional(Type.Integer()),
    retreatedAfterCombat: Type.Optional(Type.Literal(true))
})

export type ProjectedUnit = Omit<Unit, 'face'> & { face?: Face }

export type Commander = Type.Static<typeof Commander>
export const Commander = Type.Object({
    id: Type.String(),
    playerId: Type.String(),
    position: Type.Optional(Position),
    eliminated: Type.Optional(Type.Literal(true)),
    commandsThisTurn: Type.Optional(Type.Integer({ minimum: 1 })),
    enteredThisTurn: Type.Optional(Type.Literal(true))
})

/** The face as far as the current Perspective knows it. */
export function knownFace(unit: ProjectedUnit): Face | undefined {
    return unit.shown ?? unit.face
}

export function faceOf(unit: ProjectedUnit): Face {
    const face = knownFace(unit)
    assertExists(face, `The face of unit ${unit.id} is not known`)
    return face
}

export function isOnMap(piece: { position?: Position }): piece is { position: Position } {
    return piece.position !== undefined
}
