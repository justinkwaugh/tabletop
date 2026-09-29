import * as Type from 'typebox'
import type { Color } from '@tabletop/common'

export enum WarbandMoveKind {
    SiteToBoard = 'siteToBoard',
    BoardToSite = 'boardToSite',
    GiveToImperial = 'giveToImperial',
    TakeFromImperial = 'takeFromImperial'
}

/** R-6.5, R-6.5.b */
export type WarbandMove = Type.Static<typeof WarbandMove>
export const WarbandMove = Type.Union([
    Type.Object({ kind: Type.Literal(WarbandMoveKind.SiteToBoard) }),
    Type.Object({ kind: Type.Literal(WarbandMoveKind.BoardToSite) }),
    Type.Object({
        kind: Type.Literal(WarbandMoveKind.GiveToImperial),
        otherPlayerId: Type.String()
    }),
    Type.Object({
        kind: Type.Literal(WarbandMoveKind.TakeFromImperial),
        otherPlayerId: Type.String()
    })
])

export type WarbandMoveOption = { move: WarbandMove; color: Color; max: number }
