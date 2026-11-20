import {
    feudumGuildOf,
    type Character,
    type HydratedFeudumGameState,
    type MonsterId,
    type SpaceId
} from '@tabletop/feudum'
import { spaceLabel } from './cardFlows.js'
import {
    abandonedVessels,
    goodKinds,
    piecesOn,
    type AbandonedVessels,
    type GoodKind
} from './mapView.js'

export type SiteRole = 'ruler' | 'subject' | 'serf'

/** A seat as the card draws it: its chip, which reads out its name. */
export interface SiteSeat {
    readonly playerId: string
    readonly name: string
}

export interface SiteMarker extends SiteSeat {
    readonly role: SiteRole
    /** The role's word before the seat's chip: "Ruler". */
    readonly label: string
    readonly immune: boolean
}

export interface SitePawns extends SiteSeat {
    readonly characters: readonly Character[]
    readonly drunk: readonly boolean[]
    /** The characters after the seat's chip: "Knight, Monk". */
    readonly label: string
}

export interface SiteMonster {
    readonly monster: MonsterId
    /** Whose it is, as a chip after its name. */
    readonly seat?: SiteSeat
    readonly label: string
}

/** Everything that stands on one space, as a press or hover on its disc lists it. */
export interface SiteCard {
    readonly spaceId: SpaceId
    readonly title: string
    readonly markers: readonly SiteMarker[]
    /** Each seat's pawns, in one line of chips and characters. */
    readonly pawns: readonly SitePawns[]
    readonly monsters: readonly SiteMonster[]
    readonly landscape?: string
    readonly goods: readonly GoodKind[]
    readonly vessels: readonly AbandonedVessels[]
}

const Titled = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

const monsterName = (monster: MonsterId) => Titled(monster.replace('-', ' '))

/** R-4.1 What lies and stands on a space: its markers, pawns, monsters, landscape, goods, vessels. */
export function siteCardOf(
    state: HydratedFeudumGameState,
    spaceId: SpaceId,
    nameOf: (playerId: string) => string
): SiteCard {
    const space = state.spaces[spaceId]
    const { kind } = space.location
    const feudumGuild = feudumGuildOf(space.location)
    const place = feudumGuild ? `${feudumGuild} feudum` : kind
    const markers: SiteMarker[] = []
    if (space.ruler) {
        const { playerId } = space.ruler
        markers.push({
            role: 'ruler',
            playerId,
            name: nameOf(playerId),
            label: 'Ruler',
            immune: false
        })
        if (space.ruler.subject) {
            markers.push({
                role: 'subject',
                playerId,
                name: nameOf(playerId),
                label: 'Subject',
                immune: space.ruler.subjectImmune === true
            })
        }
    }
    if (space.serf) {
        const { playerId } = space.serf
        markers.push({
            role: 'serf',
            playerId,
            name: nameOf(playerId),
            label: 'Serf',
            immune: space.serf.immune === true
        })
    }
    const pieces = piecesOn(state, spaceId)
    const pawns = state.players.flatMap(({ playerId }): SitePawns[] => {
        const own = pieces.flatMap((piece) =>
            piece.kind === 'pawn' && piece.playerId === playerId ? [piece] : []
        )
        if (own.length === 0) {
            return []
        }
        const characters = own.map(({ character }) => character)
        return [
            {
                playerId,
                name: nameOf(playerId),
                characters,
                drunk: own.map(({ drunk }) => drunk),
                label: characters.map(Titled).join(', ')
            }
        ]
    })
    const monsters = pieces.flatMap((piece): SiteMonster[] =>
        piece.kind === 'monster'
            ? [
                  {
                      monster: piece.monster,
                      ...(piece.playerId
                          ? { seat: { playerId: piece.playerId, name: nameOf(piece.playerId) } }
                          : {}),
                      label: monsterName(piece.monster)
                  }
              ]
            : []
    )
    const landscape = space.landscape ? state.tileLandscapes[space.landscape.tileId] : undefined
    return {
        spaceId,
        title: `${spaceLabel(spaceId)} · ${place}`,
        markers,
        pawns,
        monsters,
        ...(landscape ? { landscape: `${Titled(landscape)} landscape` } : {}),
        goods: goodKinds(space.goods),
        vessels: abandonedVessels(space.vessels)
    }
}
