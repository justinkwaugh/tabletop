import {
    canDiscoverTitle,
    gamePaceOf,
    GamePace,
    isListedOpenGame,
    type Game,
    type GameMetadata
} from '@tabletop/common'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'

export const LobbyChannel = Type.Object({
    channelId: Type.String({ minLength: 1 }),
    roleId: Type.Optional(Type.String({ minLength: 1 })),
    /** The paces of the games this channel lists; every pace when left out. */
    paces: Type.Optional(Type.Array(Type.Enum(GamePace), { minItems: 1 }))
})
export type LobbyChannel = Static<typeof LobbyChannel>

/**
 * The Discord channels that list each Series lobby's open games, by Series id: one channel, or
 * several, such as one per pace or one per server.
 */
export const LobbyChannels = Type.Record(
    Type.String(),
    Type.Union([LobbyChannel, Type.Array(LobbyChannel, { minItems: 1 })])
)
export type LobbyChannels = Static<typeof LobbyChannels>

const LobbyChannelsValidator = Compile(LobbyChannels)

export function parseLobbyChannels(json: string | undefined): LobbyChannels {
    return json ? LobbyChannelsValidator.Parse(JSON.parse(json)) : {}
}

/** The Series lobbies posted to Discord, and which of their games anyone may see there. */
export class PostedLobbies {
    constructor(
        private readonly channels: LobbyChannels,
        private readonly titleMetadata: (titleId: string) => GameMetadata | undefined
    ) {}

    seriesIds(): string[] {
        return Object.keys(this.channels)
    }

    /** The channels that list the game, none once it leaves its lobby. */
    channelsFor(game: Game | undefined): LobbyChannel[] {
        if (!game?.series || game.deleted || !isListedOpenGame(game)) return []
        if (!this.anyoneMayDiscover(game.typeId)) return []
        const channels = this.channels[game.series] ?? []
        const { pace } = gamePaceOf(game)
        return [channels]
            .flat()
            .filter((channel) => channel.paces === undefined || channel.paces.includes(pace))
    }

    private anyoneMayDiscover(titleId: string): boolean {
        const metadata = this.titleMetadata(titleId)
        return metadata !== undefined && canDiscoverTitle(metadata, [])
    }
}
