import { canDiscoverTitle, isListedOpenGame, type Game, type GameMetadata } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'

export const LobbyChannel = Type.Object({
    channelId: Type.String({ minLength: 1 }),
    roleId: Type.Optional(Type.String({ minLength: 1 }))
})
export type LobbyChannel = Static<typeof LobbyChannel>

/** The Discord channel that lists each Series lobby's open games, by Series id. */
export const LobbyChannels = Type.Record(Type.String(), LobbyChannel)
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

    channelFor(game: Game | undefined): LobbyChannel | undefined {
        if (!game?.series || game.deleted || !isListedOpenGame(game)) return undefined
        if (!this.anyoneMayDiscover(game.typeId)) return undefined
        return this.channels[game.series]
    }

    private anyoneMayDiscover(titleId: string): boolean {
        const metadata = this.titleMetadata(titleId)
        return metadata !== undefined && canDiscoverTitle(metadata, [])
    }
}
