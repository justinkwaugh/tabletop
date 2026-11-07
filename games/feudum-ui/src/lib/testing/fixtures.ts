import { assertExists } from '@tabletop/common'
import {
    ActionType,
    collectTopTile,
    HydratedFeudumGameState,
    keepWritsOffer,
    MachineState,
    placeMarker,
    RegionIds,
    removeTopTile,
    Routes,
    Spaces,
    stackTop,
    type ActionCardKind,
    type Character,
    type Good,
    type LocationKind,
    type PouchGood,
    type RegionId,
    type SpaceId
} from '@tabletop/feudum'
import { showOnStacks } from './roundEndTable.js'
import { FeudumHost } from './sessionHarness.js'
import {
    buildFeudum,
    emptySpace,
    giveBead,
    giveGood,
    giveSeal,
    ruleOutpost,
    ruleTown
} from './turnTable.js'

/** Invented seat names: nobody's, and short enough for a phone's chips. */
export const SeatNames = ['Ana', 'Bram', 'Cleo', 'Dov', 'Esme'] as const

/** One seat's setup and first hand, by the Actions a seat would send. */
interface SeatPlan {
    readonly goods: readonly Good[]
    readonly sulfurToBarrel?: boolean
    readonly character?: Character
    readonly on?: LocationKind
    readonly hand?: readonly ActionCardKind[]
    readonly pouch?: PouchGood
}

const Plain: readonly Good[] = ['iron', 'wood', 'food']
const FillerHand: readonly ActionCardKind[] = ['tax', 'guild', 'harvest', 'migrate']

function startingSpaceShowing(host: FeudumHost, kind: LocationKind): SpaceId {
    const space = Spaces.find(
        ({ id, startingSpace }) => startingSpace && host.state.spaces[id].location.kind === kind
    )
    assertExists(space, `R-1.4 A starting space shows a ${kind}`)
    return space.id
}

/** R-1.4.8 Each seat takes its goods, in setup order. */
async function chooseGoods(host: FeudumHost, plans: readonly SeatPlan[]) {
    await host.playStartingGoods((playerId) => {
        const { goods, sulfurToBarrel } = planOf(host, plans, playerId)
        return { goods: [...goods], ...(sulfurToBarrel ? { sulfurToBarrel } : {}) }
    })
}

function planOf(host: FeudumHost, plans: readonly SeatPlan[], playerId: string): SeatPlan {
    const plan = plans[host.game.players.findIndex(({ id }) => id === playerId)]
    assertExists(plan, `Seat ${playerId} has a plan`)
    return plan
}

/** R-1.4.9 Each seat places its first pawn, in setup order. */
async function placePawns(host: FeudumHost, plans: readonly SeatPlan[]) {
    while (host.state.machineState === MachineState.PlacingStartingPawn) {
        const playerId = host.setupSeat
        const { character, on } = planOf(host, plans, playerId)
        await host.send(playerId, {
            type: ActionType.PlaceStartingPawn,
            character: character ?? 'monk',
            spaceId: startingSpaceShowing(host, on ?? 'outpost')
        })
    }
}

/** R-3.1 Every seat finalises its planned hand, in the finalise order. */
async function finalise(host: FeudumHost, plans: readonly SeatPlan[]) {
    while (host.state.machineState === MachineState.SelectingHands) {
        const playerId = host.state.flow.selection?.playerId
        assertExists(playerId, 'R-3.1 A seat is next to finalise')
        const { hand, pouch } = planOf(host, plans, playerId)
        await host.send(playerId, {
            type: ActionType.FinaliseHand,
            revealsInfo: true,
            cards: [...(hand ?? FillerHand)],
            ...(pouch ? { pouchGood: pouch } : {})
        })
    }
}

function askedSeat(host: FeudumHost): string {
    const playerId = host.state.flow.turn?.playerId
    assertExists(playerId, 'R-3.2 A seat is asked for a card')
    return playerId
}

function handOf(host: FeudumHost, playerId: string): readonly ActionCardKind[] {
    const hand = new HydratedFeudumGameState(host.state).getPlayerState(playerId).hand
    assertExists(hand, `The host holds ${playerId}'s hand`)
    return hand
}

/** R-3.2 Every seat but this one gives up a card, until this seat is asked. */
async function othersForfeitUntil(host: FeudumHost, playerId: string) {
    while (askedSeat(host) !== playerId) {
        const asked = askedSeat(host)
        await host.send(asked, { type: ActionType.ForfeitCard, kind: handOf(host, asked)[0] })
    }
}

/** Seats, goods and pawns by real Actions; the table waits at `SelectingHands`. */
async function atHands(plans: readonly SeatPlan[]): Promise<FeudumHost> {
    const host = new FeudumHost(plans.length, SeatNames.slice(0, plans.length))
    await chooseGoods(host, plans)
    await placePawns(host, plans)
    return host
}

/** The same, every seat's hand finalised; the first seat is asked. */
async function atCards(plans: readonly SeatPlan[]): Promise<FeudumHost> {
    const host = await atHands(plans)
    await finalise(host, plans)
    return host
}

const first = (host: FeudumHost) => host.order[0]
const second = (host: FeudumHost) => host.order[1]

/** R-3.8 The seat plays Influence on its pawns' spaces, and the others come back round to it. */
async function influenceThenBack(host: FeudumHost, playerId: string) {
    await othersForfeitUntil(host, playerId)
    await host.send(playerId, { type: ActionType.Influence })
    await othersForfeitUntil(host, playerId)
}

/** R-3.2 Every seat plays out its cards by forfeit; R-4.11 the round ends, by the real roll. */
export async function forfeitRound(host: FeudumHost) {
    while (host.state.machineState === MachineState.PlayingCards) {
        const asked = askedSeat(host)
        await host.send(asked, { type: ActionType.ForfeitCard, kind: handOf(host, asked)[0] })
    }
}

export interface FixtureTable {
    readonly host: FeudumHost
    /** The seat whose browser shows. */
    readonly seat: string
}

export interface Fixture {
    /**
     * Unset: every step was a real Action through the engine. Set: what a hand arranged and why no
     * short game reaches it; the logic's canonical validator still has to pass.
     */
    readonly arranged?: string
    build(): Promise<FixtureTable>
}

const seats = (...plans: readonly SeatPlan[]): readonly SeatPlan[] => plans
const plain: SeatPlan = { goods: Plain }

function townRegion(host: FeudumHost): RegionId {
    const { region } = Spaces.find(({ id }) => id === startingSpaceShowing(host, 'town')) ?? {}
    assertExists(region, 'R-1.4 A starting space shows a town')
    return region
}

/** R-3.3 The first seat could pouch a saltpeter, the second a sulfur. */
const Pouches = seats(
    { goods: ['saltpeter', 'iron', 'wood'] },
    { goods: ['sulfur', 'iron', 'wood'] },
    plain
)

/** R-4.2 Where the seat's first pawn can walk to. */
function roadNeighbour(host: FeudumHost, playerId: string): SpaceId {
    const from = new HydratedFeudumGameState(host.state).getPlayerState(playerId).pawns[0].spaceId
    const route = Routes.find(({ medium, a, b }) => medium === 'road' && (a === from || b === from))
    assertExists(route, `R-4.2 A road leaves ${from}`)
    return route.a === from ? route.b : route.a
}

/** R-3.8 Three seats; the first plays Influence on its town and is asked again. */
async function rulingTown(character: Character, hand: readonly ActionCardKind[]) {
    const host = await atCards(seats({ goods: Plain, character, on: 'town', hand }, plain, plain))
    const seat = first(host)
    await influenceThenBack(host, seat)
    return { host, seat }
}

/** R-3.8 The same on a farm. */
async function rulingFarm(character: Character, hand: readonly ActionCardKind[]) {
    const host = await atCards(seats({ goods: Plain, character, on: 'farm', hand }, plain, plain))
    const seat = first(host)
    await influenceThenBack(host, seat)
    return { host, seat }
}

/**
 * The named tables a browser spec opens. Each is a position a game can hold: `arranged` says where a
 * hand set one up. Adding one: a row here, with `seat` the browser that shows it.
 */
export const Fixtures = {
    'setup-goods': {
        build: () => {
            const host = new FeudumHost(3, SeatNames.slice(0, 3))
            return Promise.resolve({ host, seat: host.setupSeat })
        }
    },
    'setup-pawn': {
        build: async () => {
            const plans = seats(plain, plain, plain)
            const host = new FeudumHost(3, SeatNames.slice(0, 3))
            await chooseGoods(host, plans)
            return { host, seat: host.setupSeat }
        }
    },
    'setup-third-knight': {
        build: async () => {
            const plans = seats(plain, plain, plain, plain)
            const host = new FeudumHost(4, SeatNames.slice(0, 4))
            await chooseGoods(host, plans)
            for (const _ of [1, 2]) {
                await host.send(host.setupSeat, {
                    type: ActionType.PlaceStartingPawn,
                    character: 'knight',
                    spaceId: startingSpaceShowing(host, 'outpost')
                })
            }
            return { host, seat: host.setupSeat }
        }
    },
    'hands-second-sulfur': {
        build: async () => {
            const host = await atHands(Pouches)
            return { host, seat: second(host) }
        }
    },
    'hands-first-saltpeter': {
        build: async () => {
            const host = await atHands(Pouches)
            return { host, seat: first(host) }
        }
    },
    'hands-first-sulfur': {
        build: async () => {
            const host = await atHands(seats({ goods: ['sulfur', 'iron', 'wood'] }, plain, plain))
            return { host, seat: first(host) }
        }
    },
    'hands-barrel-sulfur': {
        build: async () => {
            const host = await atHands(
                seats({ goods: ['sulfur', 'iron', 'wood'], sulfurToBarrel: true }, plain, plain)
            )
            return { host, seat: first(host) }
        }
    },
    'cards-merchant-under-marker': {
        build: async () => {
            const host = await atCards(
                seats(
                    { goods: Plain, on: 'outpost', hand: ['influence', 'tax', 'guild', 'harvest'] },
                    {
                        goods: Plain,
                        character: 'merchant',
                        on: 'outpost',
                        hand: ['influence', 'tax', 'guild', 'harvest']
                    },
                    plain
                )
            )
            await host.send(first(host), { type: ActionType.Influence })
            return { host, seat: second(host) }
        }
    },
    'cards-last-conquer': {
        build: async () => {
            const host = await atCards(
                seats({ goods: Plain, hand: ['tax', 'guild', 'harvest', 'conquer'] }, plain, plain)
            )
            const seat = first(host)
            for (const _ of [1, 2, 3]) {
                await othersForfeitUntil(host, seat)
                await host.send(seat, {
                    type: ActionType.ForfeitCard,
                    kind: handOf(host, seat)[0]
                })
            }
            await othersForfeitUntil(host, seat)
            return { host, seat }
        }
    },
    'cards-sulfur-pouch': {
        build: async () => {
            const host = await atCards(
                seats(
                    {
                        goods: ['sulfur', 'iron', 'wood'],
                        on: 'town',
                        hand: ['influence', 'tax', 'guild', 'explore'],
                        pouch: 'sulfur'
                    },
                    plain,
                    plain
                )
            )
            const seat = first(host)
            await influenceThenBack(host, seat)
            return { host, seat }
        }
    },
    'cards-migrate': {
        build: async () => {
            const host = await atCards(
                seats(
                    {
                        goods: Plain,
                        character: 'alchemist',
                        on: 'outpost',
                        hand: ['migrate', 'tax', 'guild', 'harvest']
                    },
                    { goods: Plain, character: 'knight' },
                    { goods: Plain, character: 'knight' }
                )
            )
            return { host, seat: first(host) }
        }
    },
    'cards-improve-town': {
        arranged:
            'R-3.9 The seal: every way to one runs through a guild board or a Harvest with beads.',
        build: async () => {
            const { host, seat } = await rulingTown('monk', [
                'influence',
                'improve',
                'tax',
                'guild'
            ])
            host.edit((state) => giveSeal(state, seat))
            return { host, seat }
        }
    },
    'cards-tile-gone-epoch-1': {
        arranged:
            "R-4.11.1 The region's first tile gone, as the progress die's removal does after a round like the one played here, and the seal.",
        build: async () => {
            const plans = seats(
                { goods: Plain, on: 'town', hand: ['influence', 'improve', 'tax', 'guild'] },
                plain,
                plain
            )
            const host = await atCards(plans)
            const seat = first(host)
            await influenceThenBack(host, seat)
            await forfeitRound(host)
            await finalise(host, plans)
            await othersForfeitUntil(host, seat)
            host.edit((state) => {
                giveSeal(state, seat)
                const region = townRegion(host)
                if (stackTop(state, region)?.epoch === 1) {
                    removeTopTile(state, region)
                }
            })
            return { host, seat }
        }
    },
    'cards-tile-gone-epoch-3': {
        arranged:
            'R-4.11.2 Epoch III with the stacks as the die could leave them: playing there takes most of the game. And the seal.',
        build: async () => {
            const { host, seat } = await rulingTown('monk', [
                'influence',
                'improve',
                'tax',
                'guild'
            ])
            host.edit((state) => {
                giveSeal(state, seat)
                state.epoch = 3
                const town = townRegion(host)
                const others = RegionIds.filter((region) => region !== town)
                const threes = others.slice(0, 2)
                showOnStacks(
                    state,
                    RegionIds.map((region) =>
                        region === town ? 4 : threes.includes(region) ? 3 : 2
                    )
                )
            })
            return { host, seat }
        }
    },
    'cards-tend-landscape': {
        arranged:
            'R-4.3.1 Two collected tiles, one an orchard: Improve takes one, but spends the card this scenario plays.',
        build: async () => {
            const host = await atCards(
                seats(
                    { goods: Plain, on: 'outpost', hand: ['influence', 'tax', 'guild', 'harvest'] },
                    {
                        goods: Plain,
                        on: 'outpost',
                        hand: ['influence', 'improve', 'tax', 'guild']
                    },
                    plain
                )
            )
            const seat = second(host)
            await host.send(first(host), { type: ActionType.Influence })
            await host.send(seat, { type: ActionType.Influence })
            await othersForfeitUntil(host, seat)
            host.edit((state) => {
                const region = RegionIds.find((id) => {
                    const top = stackTop(state, id)
                    return top && state.requireVault().tileLandscapes[top.id] === 'orchard'
                })
                assertExists(region, 'R-1.4-H2 A stack shows an orchard')
                const another = RegionIds.find((id) => id !== region)
                assertExists(another, 'R-1.4 There are other stacks')
                collectTopTile(state, seat, region)
                collectTopTile(state, seat, another)
            })
            return { host, seat }
        }
    },
    'cards-explore': {
        arranged: 'R-3.9.1 The feudum: building one takes a seal and a second pawn first.',
        build: async () => {
            const host = await atCards(
                seats(
                    { goods: Plain, on: 'outpost', hand: ['influence', 'explore', 'tax', 'guild'] },
                    plain,
                    plain
                )
            )
            const seat = first(host)
            await influenceThenBack(host, seat)
            host.edit((state) => {
                buildFeudum(state, seat, emptySpace(state, 'town'))
                state.recomputeRanks()
            })
            return { host, seat }
        }
    },
    'cards-harvest-beads': {
        arranged: 'R-3.11 The two beads: a seat draws them at a guild board, a game away.',
        build: async () => {
            const { host, seat } = await rulingFarm('monk', [
                'influence',
                'harvest',
                'tax',
                'guild'
            ])
            host.edit((state) => {
                giveBead(state, seat)
                giveBead(state, seat)
            })
            return { host, seat }
        }
    },
    'cards-harvest-farmer': {
        arranged:
            'R-3.11.1 Two more farms ruled, for a total of 7 and two favours: a short game rules one.',
        build: async () => {
            const { host, seat } = await rulingFarm('farmer', [
                'influence',
                'harvest',
                'tax',
                'guild'
            ])
            host.edit((state) => {
                placeMarker(state, seat, emptySpace(state, 'farm'))
                placeMarker(state, seat, emptySpace(state, 'farm'))
                state.recomputeRanks()
            })
            return { host, seat }
        }
    },
    'cards-tax-knight': {
        arranged:
            'R-3.12.1 Two more towns ruled, for +4s: a short game holds one pawn on one town.',
        build: async () => {
            const { host, seat } = await rulingTown('knight', [
                'influence',
                'tax',
                'guild',
                'harvest'
            ])
            host.edit((state) => {
                ruleTown(state, seat)
                ruleTown(state, seat)
            })
            return { host, seat }
        }
    },
    'cards-repeat': {
        arranged:
            'R-3.3 A second saltpeter, for Déjà Vu after the pouch took the first, and an outpost ruled, so five cards can all be played before Repeat.',
        build: async () => {
            const host = await atCards(
                seats(
                    {
                        goods: ['saltpeter', 'iron', 'wood'],
                        on: 'farm',
                        hand: ['conquer', 'defend', 'move', 'explore', 'repeat'],
                        pouch: 'saltpeter'
                    },
                    plain,
                    plain
                )
            )
            const seat = first(host)
            host.edit((state) => {
                giveGood(state, seat, 'saltpeter')
                ruleOutpost(state, seat)
            })
            await host.send(seat, { type: ActionType.ForfeitCard, kind: 'conquer' })
            await othersForfeitUntil(host, seat)
            await host.send(seat, { type: ActionType.PlayDefend })
            await othersForfeitUntil(host, seat)
            await host.send(seat, {
                type: ActionType.Move,
                steps: [
                    {
                        piece: { kind: 'pawn', playerId: seat, n: 1 },
                        to: roadNeighbour(host, seat),
                        medium: 'road'
                    }
                ]
            })
            await othersForfeitUntil(host, seat)
            await host.send(seat, { type: ActionType.Explore, revealsInfo: true })
            const offer = keepWritsOffer(new HydratedFeudumGameState(host.state), seat)
            assertExists(offer, 'R-4.4.1 The drawer is asked to keep')
            await host.send(seat, {
                type: ActionType.KeepWrits,
                keep: offer.drawn.slice(0, offer.keep)
            })
            await othersForfeitUntil(host, seat)
            return { host, seat }
        }
    },
    'cards-defend': {
        build: async () => {
            const host = await atCards(
                seats({ goods: Plain, hand: ['defend', 'tax', 'guild', 'harvest'] }, plain, plain)
            )
            return { host, seat: first(host) }
        }
    }
} as const satisfies Record<string, Fixture>

export type FixtureName = keyof typeof Fixtures

export const FixtureNames = Object.keys(Fixtures)

function isFixtureName(name: string): name is FixtureName {
    return FixtureNames.includes(name)
}

/** A name that is no fixture is a mistake in the spec: it stops here, naming what there is. */
export function fixtureNamed(name: string): Fixture {
    if (!isFixtureName(name)) {
        throw new Error(`No fixture named "${name}". There are: ${FixtureNames.join(', ')}`)
    }
    return Fixtures[name]
}
