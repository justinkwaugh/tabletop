import { Coordinates } from './coordinates.js'

// Produces coordinates according to a pattern
export type CoordinatePattern<T extends Coordinates> = () => Iterable<T>
