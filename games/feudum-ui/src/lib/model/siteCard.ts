import type { Character, HydratedFeudumGameState, MonsterId, SpaceId } from '@tabletop/feudum'
import { spaceLabel } from './cardFlows.js'
import {
    abandonedVessels,
    goodKinds,
    piecesOn,
    type AbandonedVessels,
    type GoodKind
} from './mapView.js'

export type SiteRole = 'ruler' | 'subject' | 'serf'

export interface SiteMarker {
    readonly role: SiteRole
    readonly playerId: string
    readonly label: string
    readonly immune: boolean
}

export interface SitePawns {
    readonly playerId: string
    readonly characters: readonly Character[]
    readonly drunk: readonly boolean[]
    readonly label: string
}

export interface SiteMonster {
    readonly monster: MonsterId
    readonly playerId?: string
    readonly label: string
}

/** Everything that stands on one space, as a press or hover on its disc lists it. */
export interface SiteCard {
    readonly spaceId: SpaceId
    readonly title: string
    readonly markers: readonly SiteMarker[]
    readonly pawns: readonly SitePawns[]
    /** Each seat's pawns in one line: "Ana: Knight, Monk · Bram: Farmer". */
    readonly pawnsLine?: string
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
    const { kind, feudumGuild } = space.location
    const place = feudumGuild ? `${feudumGuild} feudum` : kind
    const markers: SiteMarker[] = []
    if (space.ruler) {
        const { playerId } = space.ruler
        markers.push({
            role: 'ruler',
            playerId,
            label: `Ruler: ${nameOf(playerId)}`,
            immune: false
        })
        if (space.ruler.subject) {
            markers.push({
                role: 'subject',
                playerId,
                label: `Subject: ${nameOf(playerId)}`,
                immune: space.ruler.subjectImmune === true
            })
        }
    }
    if (space.serf) {
        const { playerId } = space.serf
        markers.push({
            role: 'serf',
            playerId,
            label: `Serf: ${nameOf(playerId)}`,
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
                characters,
                drunk: own.map(({ drunk }) => drunk),
                label: `${nameOf(playerId)}: ${characters.map(Titled).join(', ')}`
            }
        ]
    })
    const monsters = pieces.flatMap((piece): SiteMonster[] =>
        piece.kind === 'monster'
            ? [
                  {
                      monster: piece.monster,
                      ...(piece.playerId ? { playerId: piece.playerId } : {}),
                      label: piece.playerId
                          ? `${monsterName(piece.monster)}, ${nameOf(piece.playerId)}'s`
                          : monsterName(piece.monster)
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
        ...(pawns.length > 0 ? { pawnsLine: pawns.map(({ label }) => label).join(' · ') } : {}),
        monsters,
        ...(landscape ? { landscape: `${Titled(landscape)} landscape` } : {}),
        goods: goodKinds(space.goods),
        vessels: abandonedVessels(space.vessels)
    }
}
