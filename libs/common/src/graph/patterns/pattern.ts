import { Coordinates } from '../coordinates.js'

export type CoordinatePattern<T extends Coordinates> = () => Iterable<T>
