import { Static, Type } from '@sinclair/typebox'

export enum MasterType {
    Healer = 'H',
    DragonBreeder = 'D',
    Firekeeper = 'F',
    Priest = 'P',
    Rainmaker = 'R',
    Astrologer = 'A',
    YetiWhisperer = 'Y'
}

export type Tile = Static<typeof Tile>
export const Tile = Type.Object({
    master: Type.Enum(MasterType),
    playerId: Type.String()
})
