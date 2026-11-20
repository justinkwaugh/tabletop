import { isAnswerStarve, reasonAnswerStarveRefused } from '../actions/answerStarve.js'
import { cardOf, cardPlayOffers } from '../actions/cardPlay.js'
import { attackerMayAdd } from '../actions/combat.js'
import { commitAttackOffer, isCommitAttack } from '../actions/commitAttack.js'
import { conquerOffers } from '../actions/conquer.js'
import { feastOffers, reasonFeastRefused } from '../actions/feast.js'
import {
    guildActionOffers,
    isGuildAction,
    reasonGuildActionRefused
} from '../actions/guildAction.js'
import { influenceOffers } from '../actions/influence.js'
import { keepWritsOffer } from '../actions/keepWrits.js'
import { migrateOffers } from '../actions/migrate.js'
import { moveOffers } from '../actions/move.js'
import { isPlayMandate, playMandateOffers } from '../actions/playMandate.js'
import { isScoreGame } from '../actions/scoreGame.js'
import { ActionCards, type ActionCardKind } from '../data/cards.js'
import { Goods, VesselTypes, type Good, type GuildId } from '../data/components.js'
import { RoyalWrits, type MandateAlternativeId, type WritId } from '../data/writs.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { GuildFunctionName, GuildFunctionParams } from '../guilds/guildFunction.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { writRegistry } from '../writs/writRegistry.js'
import {
    cardMove,
    handFor,
    walkCount,
    walkGame,
    type GameWalk,
    type Progress,
    type WalkMove,
    type WalkPlan,
    type WalkStep
} from './walk.js'
import { locationKindOf } from '../model/locationDiscs.js'

/** One way a writ fires, as a line of the sweep names it: a printed alternative by its id. */
export function writKey(
    writId: WritId,
    { alternative, rewardGuild }: { alternative?: MandateAlternativeId; rewardGuild?: GuildId }
): string {
    return alternative ?? `${writId} ${rewardGuild}`
}

const GoodLists: readonly (readonly Good[])[] = [4, 3, 2, 1].flatMap((length) =>
    Array.from({ length: Goods.length ** length }, (_row, row) =>
        Array.from(
            { length },
            (_cell, cell) => Goods[Math.floor(row / Goods.length ** cell) % Goods.length]
        )
    )
)

/**
 * Seats that use what no game of the walk's own seats would: every mandate, every charter, every
 * special, the Guild card. Each ask goes here first and to the walk's own play after, so everything
 * is still chosen from the real offers on the state reached, with nothing edited by hand.
 */
export class CorpusSeats implements WalkPlan {
    /** One card kind in one use, as a line of the sweep names it. */
    static cardKey(kind: ActionCardKind, mode: string): string {
        return `${cardOf(kind).id} ${mode}`
    }

    /** What has fired, and in which seed's game first. */
    readonly fired = new Map<string, string>()
    seed = ''

    private wants(key: string): boolean {
        return !this.fired.has(key)
    }

    noted(step: WalkStep): void {
        for (const key of CorpusSeats.firedBy(step)) {
            if (!this.fired.has(key)) {
                this.fired.set(key, this.seed)
            }
        }
    }

    moveFor(
        state: HydratedFeudumGameState,
        playerId: string,
        progress: Progress
    ): WalkMove | undefined {
        const atWill = this.atWillMove(state, playerId)
        if (atWill) {
            return atWill
        }
        switch (state.machineState) {
            case MachineState.SelectingHands:
                return {
                    type: ActionType.FinaliseHand,
                    playerId,
                    revealsInfo: true,
                    cards: this.handOf(state, playerId, progress)
                }
            case MachineState.PlayingCards:
                return this.cardPlay(state, playerId, progress)
            case MachineState.KeepingWrits:
                return this.keepMove(state, playerId)
            case MachineState.AwaitingImmunity:
                return this.immunityMove(state, playerId)
            case MachineState.CommittingAttack:
                return this.weaponMove(state, playerId)
            default:
                return undefined
        }
    }

    /** R-4.4-H1 A mandate goes the moment it can. */
    private atWillMove(state: HydratedFeudumGameState, playerId: string): WalkMove | undefined {
        const mandate = playMandateOffers(state, playerId).find(
            (offer) =>
                !offer.refused && !offer.wildTileNeeded && this.wants(writKey(offer.writId, offer))
        )
        if (!mandate) {
            return undefined
        }
        const { writId, alternative, rewardGuild, vessel } = mandate
        return {
            type: ActionType.PlayMandate,
            playerId,
            writId,
            ...(alternative ? { alternative } : {}),
            ...(rewardGuild ? { rewardGuild } : {}),
            ...(vessel ? { vessel } : {})
        }
    }

    /** R-3.1 The cards with a use still wanted first, then what the walk would hold. */
    private handOf(
        state: HydratedFeudumGameState,
        playerId: string,
        progress: Progress
    ): ActionCardKind[] {
        const wanted = ActionCards.map(({ kind }) => kind).filter(
            (kind) =>
                this.wants(CorpusSeats.cardKey(kind, 'regular')) ||
                this.wants(CorpusSeats.cardKey(kind, 'special'))
        )
        const rotated = wanted.map(
            (_kind, index) => wanted[(index + walkCount(state)) % wanted.length]
        )
        return [...new Set([...rotated.slice(0, 2), ...handFor(state, playerId, progress)])].slice(
            0,
            4
        )
    }

    private cardPlay(
        state: HydratedFeudumGameState,
        playerId: string,
        progress: Progress
    ): WalkMove | undefined {
        const hand = state.getPlayerState(playerId).requireHand()
        const held = (kind: ActionCardKind) => hand.includes(kind)
        return (
            (held('repeat') ? this.replayMove(state, playerId, progress) : undefined) ??
            (held('guild') ? this.guildMove(state, playerId) : undefined) ??
            (held('migrate') ? this.distantKinMove(state, playerId) : undefined) ??
            (held('move') ? this.godspeedMove(state, playerId) : undefined) ??
            (held('influence') ? this.moneyMove(state, playerId) : undefined) ??
            (held('conquer') ? this.attackWithWeapon(state, playerId) : undefined)
        )
    }

    /** R-3.15 Whichever replay is still wanted, on what the walk would do with that card. */
    private replayMove(
        state: HydratedFeudumGameState,
        playerId: string,
        progress: Progress
    ): WalkMove | undefined {
        for (const { kind, mode } of cardPlayOffers(state, playerId).repeats) {
            if (
                this.wants(CorpusSeats.cardKey('repeat', mode === 'repeat' ? 'regular' : 'special'))
            ) {
                const move = cardMove(state, playerId, kind, progress)
                if (move) {
                    return { ...move, asRepeat: mode }
                }
            }
        }
        return undefined
    }

    /** R-3.16 The first function, by the card or by a Feast, that some input opens. */
    private guildMove(state: HydratedFeudumGameState, playerId: string): WalkMove | undefined {
        const params = CorpusSeats.paramsToTry(state, playerId)
        if (this.wants(CorpusSeats.cardKey('guild', 'special'))) {
            for (const { spaceId, opponentId, guildId, reason } of feastOffers(state, playerId)) {
                const input = { spaceId, opponentId, guildId }
                const legal = reason
                    ? undefined
                    : params.find(
                          (tried) =>
                              !reasonFeastRefused(state, playerId, { ...input, params: tried })
                      )
                if (legal) {
                    return { type: ActionType.Feast, playerId, ...input, params: legal }
                }
            }
        }
        for (const { guildId, fn, reason } of guildActionOffers(state, playerId)) {
            if (!reason && this.wantsFunction(guildId, fn)) {
                const legal = params.find(
                    (tried) =>
                        !reasonGuildActionRefused(state, playerId, { guildId, fn, params: tried })
                )
                if (legal) {
                    return { type: ActionType.GuildAction, playerId, guildId, fn, params: legal }
                }
            }
        }
        return undefined
    }

    private wantsFunction(guildId: GuildId, fn: GuildFunctionName): boolean {
        return (
            this.wants(CorpusSeats.cardKey('guild', 'regular')) ||
            this.wants(`guild.${guildId} ${fn}`)
        )
    }

    /** R-3.6.2 An Alchemist on the board first, since Distant Kin needs one. */
    private distantKinMove(state: HydratedFeudumGameState, playerId: string): WalkMove | undefined {
        if (!this.wants(CorpusSeats.cardKey('migrate', 'special'))) {
            return undefined
        }
        const { pawnsOff, spaces, distantKinSpaces, wildTileNeeded } = migrateOffers(
            state,
            playerId
        )
        const [pawn] = pawnsOff
        const [spaceId] = distantKinSpaces
        if (!pawn || wildTileNeeded) {
            return undefined
        }
        if (spaceId) {
            return {
                type: ActionType.Migrate,
                playerId,
                pawn,
                onto: { character: 'farmer', spaceId },
                distantKin: true
            }
        }
        return spaces[0] && pawnsOff.length > 1
            ? {
                  type: ActionType.Migrate,
                  playerId,
                  pawn,
                  onto: { character: 'alchemist', spaceId: spaces[0] }
              }
            : undefined
    }

    private godspeedMove(state: HydratedFeudumGameState, playerId: string): WalkMove | undefined {
        if (!this.wants(CorpusSeats.cardKey('move', 'special'))) {
            return undefined
        }
        for (const { pawn, ways } of moveOffers(state, playerId).godspeed) {
            const way = ways.find(({ vessel }) => vessel !== 'place')
            if (way) {
                return {
                    type: ActionType.Move,
                    playerId,
                    steps: [],
                    godspeed: {
                        pawn,
                        to: way.to,
                        medium: way.route.medium,
                        ...(way.vessel ? { vessel: way.vessel } : {}),
                        ...(way.ferry ? { ferry: way.ferry } : {})
                    }
                }
            }
        }
        return undefined
    }

    private moneyMove(state: HydratedFeudumGameState, playerId: string): WalkMove | undefined {
        const { moneyIsInfluence, short, spaces, markers } = influenceOffers(state, playerId)
        const [spaceId] = moneyIsInfluence
        return this.wants(CorpusSeats.cardKey('influence', 'special')) && spaceId
            ? {
                  type: ActionType.Influence,
                  playerId,
                  moneyIsInfluence: spaceId,
                  // R-3.8.3 A seat short of markers names the space it takes among those it marks.
                  ...(short
                      ? {
                            spaceIds: [
                                spaceId,
                                ...spaces.filter((other) => other !== spaceId)
                            ].slice(0, markers)
                        }
                      : {})
              }
            : undefined
    }

    /** R-4.8.2 A wanted weapon needs an attack to go with. */
    private attackWithWeapon(
        state: HydratedFeudumGameState,
        playerId: string
    ): WalkMove | undefined {
        const writs = state.getPlayerState(playerId).writs ?? []
        const armed = writs.some((writId) => {
            const writ = RoyalWrits.find(({ id }) => id === writId)
            return writ?.kind === 'turn-in' && writ.weapon
        })
        const [attack] =
            armed && attackerMayAdd(state, playerId) ? conquerOffers(state, playerId) : []
        return attack
            ? {
                  type: ActionType.Conquer,
                  playerId,
                  spaceId: attack.spaceId,
                  target: attack.target
              }
            : undefined
    }

    /** R-4.4.1 Wanted writs first, so a charter or a mandate not yet seen is kept. */
    private keepMove(state: HydratedFeudumGameState, playerId: string): WalkMove | undefined {
        const offer = keepWritsOffer(state, playerId)
        if (!offer) {
            return undefined
        }
        const wanted = (writId: WritId) =>
            this.wants(writId) ||
            [
                ...writRegistry.mandateAlternatives(writId),
                ...writRegistry.weaponBonuses(writId)
            ].some((choice) => this.wants(writKey(writId, choice)))
        const keep = [...offer.drawn]
            .sort((a, b) => Number(wanted(b)) - Number(wanted(a)))
            .slice(0, offer.keep)
        const shovels = offer.shovelsAndSwords && !offer.shovelsAndSwords.wildTileNeeded
        return {
            type: ActionType.KeepWrits,
            playerId,
            keep,
            ...(shovels ? { shovelsAndSwords: true } : {})
        }
    }

    private immunityMove(state: HydratedFeudumGameState, playerId: string): WalkMove | undefined {
        return this.wants(CorpusSeats.cardKey('defend', 'special')) &&
            !reasonAnswerStarveRefused(state, playerId, true)
            ? {
                  type: ActionType.AnswerStarve,
                  playerId,
                  revealsInfo: true,
                  royalImmunity: true
              }
            : undefined
    }

    private weaponMove(state: HydratedFeudumGameState, playerId: string): WalkMove | undefined {
        const offer = commitAttackOffer(state, playerId)
        const { goods } = state.getPlayerState(playerId)
        const weapon = offer?.weapons.find(
            ({ writId, alternative, turnedIn }) =>
                turnedIn.every((good) => goods[good] > 0) &&
                this.wants(writKey(writId, { alternative }))
        )
        return weapon && offer
            ? {
                  type: ActionType.CommitAttack,
                  playerId,
                  saltpeter: 0,
                  weapons: [{ writId: weapon.writId, alternative: weapon.alternative }]
              }
            : undefined
    }

    /** What one user Action fired: the cards in `played`, the writs in its Actions. */
    private static firedBy({ processed, after }: WalkStep): string[] {
        const cards = after.flatMap(({ players }) =>
            players.flatMap(({ played }) =>
                played.map(({ kind, use, replayedKind, dejaVu }) =>
                    replayedKind
                        ? CorpusSeats.cardKey('repeat', dejaVu ? 'special' : 'regular')
                        : CorpusSeats.cardKey(kind, use)
                )
            )
        )
        const writs = processed.flatMap((action): string[] => {
            if (isPlayMandate(action)) {
                return [writKey(action.writId, action)]
            }
            if (isCommitAttack(action)) {
                return action.weapons.map((weapon) => writKey(weapon.writId, weapon))
            }
            if (isScoreGame(action)) {
                return (action.metadata?.sheet ?? []).flatMap(({ charters }) =>
                    charters.filter(({ vp }) => vp > 0).map(({ writId }) => writId)
                )
            }
            if (isAnswerStarve(action) && action.royalImmunity) {
                return [CorpusSeats.cardKey('defend', 'special')]
            }
            if (isGuildAction(action)) {
                return [`guild.${action.guildId} ${action.fn}`]
            }
            return []
        })
        return [...cards, ...writs]
    }

    /** The input a guild function might take: the seat's real farms and whatever goods fit. */
    private static paramsToTry(
        state: HydratedFeudumGameState,
        playerId: string
    ): readonly GuildFunctionParams[] {
        const farms = state
            .ruledSpaceIds(playerId)
            .filter((spaceId) => locationKindOf(state.spaces[spaceId].location) === 'farm')
        return [
            {},
            ...farms.flatMap((farmSpaceId) =>
                [0, 1, 2, 3].map((takeFood) => ({ farmSpaceId, takeFood }))
            ),
            ...VesselTypes.map((vesselType) => ({ vesselType })),
            ...GoodLists.map((goods) => ({ goods: [...goods] }))
        ]
    }
}

export interface CorpusGames {
    readonly fired: ReadonlyMap<string, string>
    readonly walks: readonly GameWalk[]
}

/** One game of a corpus: the seed and the seats at its table. */
export interface CorpusGame {
    readonly seed: string
    readonly numPlayers: number
}

/** The games in order: each seat wants what no earlier game has fired. */
export function corpusGames(games: readonly CorpusGame[]): CorpusGames {
    const seats = new CorpusSeats()
    const walks = games.map(({ seed, numPlayers }) => {
        seats.seed = seed
        return walkGame(seed, numPlayers, seats)
    })
    return { fired: seats.fired, walks }
}
