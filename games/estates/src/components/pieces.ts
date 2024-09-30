import { Type, type Static } from '@sinclair/typebox'
import { Cube } from './cube'
import { Roof } from './roof'
import { Barrier } from './barrier'
import { Mayor } from './mayor'
import { CancelCube } from './cancelCube'

export type Piece = Static<typeof Piece>
export const Piece = Type.Union([Cube, Roof, Barrier, Mayor, CancelCube])
