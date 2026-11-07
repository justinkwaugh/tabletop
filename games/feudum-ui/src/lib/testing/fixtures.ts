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
    replaceLocationDisc,
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
import { holdWrit } from './followUpTable.js'
import {
    abandonVessel,
    giveMonster,
    giveVessel,
    landscapeOn,
    sellOut,
    serfOn
} from './moveTable.js'
import { showOnStacks } from './roundEndTable.js'
import { FeudumHost } from './sessionHarness.js'
import {
    addPawn,
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
    readonly space?: SpaceId
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
        const { character, on, space } = planOf(host, plans, playerId)
        await host.send(playerId, {
            type: ActionType.PlaceStartingPawn,
            character: character ?? 'monk',
            spaceId: space ?? startingSpaceShowing(host, on ?? 'outpost')
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

const Forest1: SpaceId = 'space.forest.1'
const Forest2: SpaceId = 'space.forest.2'
const Forest3: SpaceId = 'space.forest.3'
const Desert1: SpaceId = 'space.desert.1'
const Desert3: SpaceId = 'space.desert.3'
const Desert4: SpaceId = 'space.desert.4'
const Mountain1: SpaceId = 'space.mountain.1'

function othersOf(state: HydratedFeudumGameState, seat: string): readonly string[] {
    return state.players.map(({ playerId }) => playerId).filter((playerId) => playerId !== seat)
}

/** R-3.7 A seat that moves first this round, with the rest of its hand to come. */
const mover = (character: Character, space: SpaceId): SeatPlan => ({
    goods: Plain,
    character,
    space,
    hand: ['move', 'tax', 'guild', 'harvest']
})

/** A seat that moves first; a hand sets its pieces, since those a Move starts with come by guilds. */
async function moverArranged(
    character: Character,
    space: SpaceId,
    arrange: (state: HydratedFeudumGameState, seat: string) => void
) {
    const host = await atCards(seats(mover(character, space), plain, plain))
    const seat = first(host)
    host.edit((state) => {
        arrange(state, seat)
        state.recomputeRanks()
    })
    return { host, seat }
}

/** R-3.7.5 The seat moves its farmer by road, the others come back round, and Repeat is next. */
async function movedOnce(host: FeudumHost, seat: string) {
    await othersForfeitUntil(host, seat)
    await host.send(seat, {
        type: ActionType.Move,
        steps: [{ piece: { kind: 'pawn', playerId: seat, n: 1 }, to: Forest3, medium: 'road' }]
    })
    await othersForfeitUntil(host, seat)
}

const VoyagePlans = seats(
    { goods: Plain, character: 'farmer', hand: ['move', 'repeat', 'tax', 'guild'] },
    plain,
    plain
)

/** R-4.8 The defender's knight, the attacker's knight, a third seat on a space of its own. */
const combatSeats = (
    defenderHand: readonly ActionCardKind[],
    attackerHand: readonly ActionCardKind[],
    attackerGoods: readonly Good[]
) =>
    seats(
        { goods: Plain, character: 'knight', space: Forest2, hand: defenderHand },
        { goods: attackerGoods, character: 'knight', space: Forest2, hand: attackerHand },
        { goods: Plain, space: Desert3 }
    )

const ChargeGoods: readonly Good[] = ['saltpeter', 'iron', 'food']
const NoDefend: readonly ActionCardKind[] = ['tax', 'guild', 'harvest', 'migrate']
const HoldsDefend: readonly ActionCardKind[] = ['tax', 'guild', 'harvest', 'defend']

/**
 * R-3.6, R-4.8.2 Two rounds of the attacker's Migrate bring it to three pawns on the defender's
 * space: 3 attack against 2 defence. The attacker is asked again, in the second round.
 */
async function threeAgainstOne(plans: readonly SeatPlan[]) {
    const host = await atCards(plans)
    const defender = first(host)
    const attacker = second(host)
    const migrate = async (pawn: number, character: Character) => {
        await othersForfeitUntil(host, attacker)
        await host.send(attacker, {
            type: ActionType.Migrate,
            pawn,
            onto: { character, spaceId: Forest2 }
        })
    }
    await migrate(2, 'merchant')
    await forfeitRound(host)
    await finalise(host, plans)
    await migrate(3, 'alchemist')
    return { host, defender, attacker }
}

const conquerPawn = (host: FeudumHost, attacker: string, defender: string, asks: boolean) =>
    host.send(attacker, {
        type: ActionType.Conquer,
        spaceId: Forest2,
        target: { kind: 'pawn', playerId: defender, n: 1 },
        ...(asks ? { revealsInfo: true } : {})
    })

/** R-3.14.1 The Conquer sent: the knight's owner is asked. */
async function askedDefender(defenderHand: readonly ActionCardKind[], goods = ChargeGoods) {
    const plans = combatSeats(defenderHand, ['migrate', 'conquer', 'tax', 'guild'], goods)
    const table = await threeAgainstOne(plans)
    await othersForfeitUntil(table.host, table.attacker)
    await conquerPawn(table.host, table.attacker, table.defender, true)
    return { ...table, seat: table.defender }
}

/** R-3.14.1 The defender played Defend this round: the attacker is asked, and nobody answers. */
async function defendPlayed() {
    const { host, defender, attacker } = await threeAgainstOne(
        combatSeats(HoldsDefend, ['migrate', 'conquer', 'tax', 'guild'], ChargeGoods)
    )
    await othersForfeitUntil(host, defender)
    await host.send(defender, { type: ActionType.PlayDefend })
    await othersForfeitUntil(host, attacker)
    return { host, defender, attacker }
}

/**
 * R-3.13.2 The first seat's Noble and the second seat's farmer stand on one outpost and each plays
 * Influence: ruler and serf. The Noble's seat is asked for a card.
 */
const StarvePlans = seats(
    {
        goods: Plain,
        character: 'noble',
        space: Forest2,
        hand: ['influence', 'conquer', 'migrate', 'tax']
    },
    {
        goods: Plain,
        character: 'farmer',
        space: Forest2,
        hand: ['influence', 'defend', 'migrate', 'tax']
    },
    { goods: Plain, space: Desert3 }
)

async function starvingTable() {
    const host = await atCards(StarvePlans)
    const noble = first(host)
    const served = second(host)
    await host.send(noble, { type: ActionType.Influence })
    await host.send(served, { type: ActionType.Influence })
    await othersForfeitUntil(host, noble)
    return { host, noble, served }
}

/** R-3.14.2 The serf's owner answers the starve with Royal Immunity. */
async function immunityAnswered() {
    const table = await starvingTable()
    const { host, noble, served } = table
    await host.send(noble, {
        type: ActionType.StarveThePeople,
        spaceId: Forest2,
        targetPlayerId: served,
        role: 'serf',
        revealsInfo: true
    })
    await host.send(served, {
        type: ActionType.AnswerStarve,
        revealsInfo: true,
        royalImmunity: true
    })
    return table
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
    },
    'move-trail': {
        arranged:
            'R-3.7.1 A second pawn, a monster and a ship: the Knight and Alchemist Guilds give them, over rounds this table has no need of.',
        build: () =>
            moverArranged('farmer', Desert3, (state, seat) => {
                addPawn(state, seat, 'farmer', Forest1)
                giveMonster(state, seat, 'behemoth', Mountain1)
                giveVessel(state, seat, 'ship')
            })
    },
    'move-way-popup': {
        arranged:
            'R-4.2 A flying machine, and a pawn where a road and a machine both reach: the Alchemist Guild sells the one, and walking there takes rounds.',
        build: () =>
            moverArranged('farmer', Desert3, (state, seat) => {
                addPawn(state, seat, 'farmer', Mountain1)
                giveVessel(state, seat, 'flying-machine')
            })
    },
    'move-ferry': {
        arranged:
            "R-4.2.3 The Alchemist's vessels sold out, which the ferries wait on: buying both takes two guild actions and the shillings for them.",
        build: () => moverArranged('farmer', Desert4, sellOut)
    },
    'move-vessel-for-sale': {
        build: async () => {
            const host = await atCards(seats(mover('farmer', Desert4), plain, plain))
            return { host, seat: first(host) }
        }
    },
    'move-port': {
        arranged:
            'R-4.2.2 A ship in supply at a port: the Alchemist Guild sells it, and the pawn has to walk to the port first.',
        build: () =>
            moverArranged('farmer', Desert3, (state, seat) => {
                state.getPlayerState(seat).pawns[0].spaceId = Desert1
                giveVessel(state, seat, 'ship')
            })
    },
    'move-port-abandoned': {
        arranged:
            'R-4.2.2 As at the port, with a submersible abandoned there: a rider has to leave it behind in an earlier Move.',
        build: () =>
            moverArranged('farmer', Desert3, (state, seat) => {
                state.getPlayerState(seat).pawns[0].spaceId = Desert1
                giveVessel(state, seat, 'ship')
                abandonVessel(state, Desert1, 'submersible')
            })
    },
    'move-pinned': {
        arranged:
            "R-4.2.4 An opponent's monster on the pawn's space: it comes by Tame the Beast and its own Move.",
        build: () =>
            moverArranged('farmer', Forest3, (state, seat) => {
                addPawn(state, seat, 'farmer', Desert3)
                addPawn(state, seat, 'farmer', Forest1)
                giveMonster(state, othersOf(state, seat)[0], 'behemoth', Forest3)
            })
    },
    'move-godspeed': {
        arranged:
            "R-3.7.3, R-3.7.4 Three pawns, a farm the seat rules and an opponent's landscape: three of a game's slowest things to bring together on one table.",
        build: () =>
            moverArranged('monk', Desert4, (state, seat) => {
                const [serf, ruler] = othersOf(state, seat)
                addPawn(state, seat, 'farmer', Desert3)
                addPawn(state, seat, 'farmer', Forest2)
                placeMarker(state, seat, Forest1)
                serfOn(state, Forest3, ruler, serf)
                landscapeOn(state, Forest3, 'archery-butt')
            })
    },
    'move-last-step-monk': {
        build: async () => {
            const host = await atCards(seats(mover('monk', Forest2), plain, plain))
            return { host, seat: first(host) }
        }
    },
    'move-last-step-farmer': {
        build: async () => {
            const host = await atCards(seats(mover('farmer', Forest2), plain, plain))
            return { host, seat: first(host) }
        }
    },
    'voyage-repeat': {
        build: async () => {
            const host = await atCards(VoyagePlans)
            const seat = first(host)
            await movedOnce(host, seat)
            return { host, seat }
        }
    },
    'voyage-advance': {
        build: async () => {
            const host = await atCards(VoyagePlans)
            const seat = first(host)
            await movedOnce(host, seat)
            await host.send(seat, {
                type: ActionType.Move,
                asRepeat: 'repeat',
                steps: [
                    {
                        piece: { kind: 'pawn', playerId: seat, n: 1 },
                        to: Forest2,
                        medium: 'road'
                    }
                ]
            })
            await host.send(seat, { type: ActionType.PlaceDisc, place: true })
            await forfeitRound(host)
            await finalise(host, VoyagePlans)
            await movedOnce(host, seat)
            return { host, seat }
        }
    },
    'conquer-asks': {
        build: async () => {
            const { host, attacker } = await threeAgainstOne(
                combatSeats(HoldsDefend, ['migrate', 'conquer', 'tax', 'guild'], ChargeGoods)
            )
            await othersForfeitUntil(host, attacker)
            return { host, seat: attacker }
        }
    },
    'conquer-asked-defend': {
        build: () => askedDefender(HoldsDefend)
    },
    'conquer-asked-no-defend': {
        build: () => askedDefender(NoDefend)
    },
    'conquer-asked-defend-nothing-to-add': {
        build: () => askedDefender(HoldsDefend, ['wood', 'food', 'sulfur'])
    },
    'conquer-no-ask': {
        build: async () => {
            const { host, attacker } = await defendPlayed()
            return { host, seat: attacker }
        }
    },
    'conquer-commit': {
        arranged:
            "R-4.4 Mandate 3 in the attacker's hand: writs come from Explore, off a deck the seed orders, and this one is not near its top.",
        build: async () => {
            const { host, attacker, defender } = await askedDefender(HoldsDefend)
            await host.send(defender, {
                type: ActionType.AnswerAttack,
                revealsInfo: true,
                flipDefend: true
            })
            host.edit((state) => holdWrit(state, attacker, 'writ.mandate.3'))
            return { host, seat: attacker }
        }
    },
    'conquer-feudum': {
        arranged:
            'R-3.9 The feudum where the markers stand: building one takes an Improve with seals and a tile, and this table only needs it fallen.',
        build: async () => {
            const plans = combatSeats(
                ['influence', 'tax', 'guild', 'harvest'],
                ['influence', 'migrate', 'conquer', 'tax'],
                ChargeGoods
            )
            const host = await atCards(plans)
            const defender = first(host)
            const attacker = second(host)
            await host.send(defender, { type: ActionType.Influence })
            await host.send(attacker, { type: ActionType.Influence })
            const migrate = async (pawn: number, character: Character) => {
                await othersForfeitUntil(host, attacker)
                await host.send(attacker, {
                    type: ActionType.Migrate,
                    pawn,
                    onto: { character, spaceId: Forest2 }
                })
            }
            await migrate(2, 'knight')
            await forfeitRound(host)
            await finalise(host, plans)
            await migrate(3, 'alchemist')
            await othersForfeitUntil(host, attacker)
            host.edit((state) => {
                replaceLocationDisc(state, Forest2, 'disc.feudum.knight-1', 'feudum', 'knight')
                state.recomputeRanks()
            })
            return { host, seat: attacker }
        }
    },
    'starve-asks': {
        build: async () => {
            const { host, noble } = await starvingTable()
            return { host, seat: noble }
        }
    },
    'starve-reclaim': {
        build: async () => {
            const { host, served } = await immunityAnswered()
            await othersForfeitUntil(host, served)
            return { host, seat: served }
        }
    },
    'starve-sealed': {
        arranged:
            'R-3.13.2 A second Noble beside a second serf, so the sealed marker has one to be told from: walking both there and playing Influence again takes rounds this table has no need of.',
        build: async () => {
            const { host, noble, served } = await immunityAnswered()
            await forfeitRound(host)
            await finalise(host, StarvePlans)
            await othersForfeitUntil(host, noble)
            host.edit((state) => {
                addPawn(state, noble, 'noble', Forest3)
                serfOn(state, Forest3, noble, served)
                state.recomputeRanks()
            })
            return { host, seat: noble }
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
