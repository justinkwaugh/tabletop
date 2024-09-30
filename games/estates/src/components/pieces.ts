import { Type, type Static } from '@sinclair/typebox'
import { Cube } from './cube.js'
import { Roof } from './roof.js'
import { Barrier } from './barrier.js'
import { Mayor } from './mayor.js'
import { CancelCube } from './cancelCube.js'

export type Piece = Static<typeof Piece>
export const Piece = Type.Union([Cube, Roof, Barrier, Mayor, CancelCube])
