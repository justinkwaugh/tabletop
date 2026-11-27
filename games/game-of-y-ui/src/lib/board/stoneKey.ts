import type { Stone } from '@tabletop/game-of-y'

// A stone as the board draws it. Its id is its place in the order of play, so two lines of play,
// an exploration and the game or an Undo and the move after it, can give one id to different
// points; the point tells them apart, so one lifts off as the other drops in.
export type StoneKey = `${number}@${string}`
export const stoneKey = (stone: Stone): StoneKey => `${stone.id}@${stone.point}`
