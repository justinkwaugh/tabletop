import { assertExists } from '@tabletop/common'
import {
    ActionType,
    collectTopTile,
    HydratedFeudumGameState,
    keepWritsOffer,
    MachineState,
    nourishOffer,
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
    type GuildFunctionName,
    type GuildFunctionParams,
    type GuildId,
    type LocationKind,
    type PouchGood,
    type RegionId,
    type SpaceId,
    type WritId
} from '@tabletop/feudum'
import { fillBarrel, holdFood, holdWrit, threePawns } from './followUpTable.js'
import { seatRowIndex, setBarn, setMarket, setRowMarkers, setShillings } from './guildTable.js'
import {
    abandonVessel,
    giveMonster,
    giveVessel,
    landscapeOn,
    sellOut,
    serfOn
} from './moveTable.js'
import { showOnStacks, tendLandscape } from './roundEndTable.js'
import { FeudumHost } from './sessionHarness.js'
import {
    addPawn,
    buildFeudum,
    emptySpace,
    giveBead,
    giveGood,
    giveSeal,
    giveTile,
    returnGoods,
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

/**
 * R-3.2 Every seat plays out its cards by forfeit; R-4.10-H4 each seat nourishing waits on sends its
 * preselected feeding, until it waits on `stopAt`; R-4.11 the round ends, by the real roll.
 */
export async function forfeitRound(host: FeudumHost, stopAt?: string) {
    while (host.state.machineState === MachineState.PlayingCards) {
        const asked = askedSeat(host)
        await host.send(asked, { type: ActionType.ForfeitCard, kind: handOf(host, asked)[0] })
    }
    while (host.state.machineState === MachineState.Nourishing) {
        const [asked] = host.state.activePlayerIds
        if (asked === stopAt) {
            return
        }
        const offer = nourishOffer(new HydratedFeudumGameState(host.state), asked)
        assertExists(offer, 'R-4.10-H4 The seat nourishing waits on decides its feeding')
        await host.send(asked, { type: ActionType.Nourish, ...offer.preselected })
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

/** R-3.16 A seat that plays its Guild card first this round, with the rest of its hand to come. */
const guildSeat = (character: Character, extra: Partial<SeatPlan> = {}): SeatPlan => ({
    goods: Plain,
    character,
    hand: ['guild', 'tax', 'harvest', 'migrate'],
    ...extra
})

/** R-4.5.3 The first seat placed takes a guild's top, the second its journeyman's place below. */
const masterAndJourneyman = (guild: Character) => seats(guildSeat(guild), guildSeat(guild), plain)

const guildAction = (
    host: FeudumHost,
    playerId: string,
    guildId: GuildId,
    fn: GuildFunctionName,
    params: GuildFunctionParams = {}
) => host.send(playerId, { type: ActionType.GuildAction, guildId, fn, params })

/** R-3.16.1 The first seat asked plays its Guild card. */
async function atGuild(plans: readonly SeatPlan[]) {
    const host = await atCards(plans)
    return { host, seat: first(host) }
}

/** R-3.16.1 The second seat asked, the journeyman of `guild`, plays its Guild card. */
async function journeymanAtGuild(guild: Character) {
    const host = await atCards(masterAndJourneyman(guild))
    const seat = second(host)
    await othersForfeitUntil(host, seat)
    return { host, seat }
}

/** R-4.6.3 Merchant trades by the other two seats leave two bins two short at the same spaces. */
async function marketTwoShort() {
    const plans = seats(guildSeat('merchant'), guildSeat('merchant'), guildSeat('monk'))
    const host = await atCards(plans)
    const [master, journeyman, third] = host.order
    await guildAction(host, master, 'merchant', 'trade', { goods: ['iron', 'iron'] })
    await host.send(journeyman, { type: ActionType.ForfeitCard, kind: 'tax' })
    await guildAction(host, third, 'merchant', 'trade', { goods: ['wood', 'wood'] })
    await othersForfeitUntil(host, journeyman)
    return { host, seat: journeyman }
}

/** R-4.4 The seat's goods and coin gone and, if `tile`, a collected tile at its hand. */
async function shortOfPayment(tile: boolean) {
    const host = await atCards(
        seats(
            {
                goods: Plain,
                character: 'farmer',
                space: Desert3,
                hand: ['migrate', 'guild', 'tax', 'harvest']
            },
            { goods: Plain, character: 'merchant', space: Desert3 },
            plain
        )
    )
    const seat = first(host)
    host.edit((state) => {
        returnGoods(state, seat)
        setShillings(state, seat, 0)
        if (tile) {
            giveTile(state, seat)
        }
    })
    return { host, seat }
}

/** R-3.10.1 The first seat rules its outpost by Influence and is asked again, an Explore in hand. */
async function exploring(hand: readonly ActionCardKind[]) {
    const host = await atCards(seats({ goods: Plain, on: 'outpost', hand }, plain, plain))
    const seat = first(host)
    await influenceThenBack(host, seat)
    return { host, seat }
}

/** R-3.2 Every card but the last of the round is played out by forfeit. */
async function forfeitAllButOne(host: FeudumHost) {
    const left = () =>
        new HydratedFeudumGameState(host.state).players.reduce(
            (sum, { handCount }) => sum + handCount,
            0
        )
    while (left() > 1) {
        const asked = askedSeat(host)
        await host.send(asked, { type: ActionType.ForfeitCard, kind: handOf(host, asked)[0] })
    }
}

/**
 * R-4.11.2 Epoch I with three stacks showing tile II and two a tile III, so the die's only legal face
 * is Desert's tile I, and taking it shows the fourth tile II.
 */
const DesertLast = [2, 2, 2, 1, 3, 3] as const

/** R-4.12 A dawn's table: a serf's landscape, a vassal, and the stacks one roll from epoch II. */
async function dawnNext(
    arrange: (state: HydratedFeudumGameState, seats: readonly string[]) => void
) {
    const host = await atCards(seats(plain, plain, plain))
    host.edit((state) => {
        arrange(state, host.order)
        showOnStacks(state, DesertLast)
        state.recomputeRanks()
    })
    return host
}

const SulfurCharter: WritId = 'writ.charter.sulfur-barrel'

/**
 * R-6.1, R-6.3 Epoch IV with a stack empty, so the round's end is the V dawn and the game's. The
 * first seat holds the sulfur charter and a seal, so R-4.4.3 seals it at the end; the scores before it are lifted so the first two seats tie on
 * vp, the first with the fuller barrel.
 */
async function gameEnding(lift: readonly number[]) {
    const host = await atCards(
        seats({ goods: ['sulfur', 'iron', 'food'], sulfurToBarrel: true }, plain, plain)
    )
    const [ana, bram] = host.order
    host.edit((state) => {
        state.epoch = 4
        showOnStacks(state, ['V', 4, 4, 4, 4, 4])
        fillBarrel(state, ana, 1)
        fillBarrel(state, bram, 1)
        giveSeal(state, ana)
        holdWrit(state, ana, SulfurCharter)
        host.order.forEach((playerId, index) => {
            state.getPlayerState(playerId).score += lift[index] ?? 0
        })
    })
    await forfeitRound(host)
    await feedWithFood(host)
    return host
}

/** R-4.10.1 Each seat nourishing asks feeds every pawn food. */
async function feedWithFood(host: FeudumHost) {
    while (host.state.machineState === MachineState.Nourishing) {
        const [playerId] = host.state.flow.nourish?.pending ?? []
        assertExists(playerId, 'R-4.10 A seat is asked to nourish')
        await host.send(playerId, { type: ActionType.Nourish, wineFed: [], unfed: [] })
    }
}

/** R-6.3 The lifts that tie the first two seats at the top, from a game played out without them. */
async function tyingLifts(): Promise<number[]> {
    const played = await gameEnding([0, 0, 0])
    const totals = new HydratedFeudumGameState(played.state).players.map(({ score }) => score)
    const top = Math.max(...totals) + 5
    return totals.map((total, index) => (index < 2 ? top - total : 0))
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
    },
    'guild-pick': {
        build: () => atGuild(seats(guildSeat('merchant'), plain, plain))
    },
    'guild-pick-repeat': {
        build: async () => {
            const host = await atCards(
                seats(
                    guildSeat('merchant', { hand: ['guild', 'repeat', 'tax', 'harvest'] }),
                    plain,
                    plain
                )
            )
            const seat = first(host)
            await guildAction(host, seat, 'alchemist', 'trade', { vesselType: 'flying-machine' })
            await othersForfeitUntil(host, seat)
            return { host, seat }
        }
    },
    'guild-merchant-pull': {
        arranged:
            "R-4.6.4 Two iron and a wood in the barn, and the market's iron and wood bins emptied to their first spaces: only Farmer trades fill the barn, and the market empties three goods to a trade.",
        build: async () => {
            const { host, seat } = await journeymanAtGuild('merchant')
            host.edit((state) => {
                setBarn(state, { iron: 2, wood: 1 })
                setMarket(state, { saltpeter: 3, sulfur: 3, iron: 1, wood: 3, food: 3 })
            })
            return { host, seat }
        }
    },
    'guild-below-threshold': {
        arranged:
            'R-4.6.4 A barn holding one iron: a pull moves every good that fits, and the opening barn holds a good whose market bin a pull of three completes.',
        build: async () => {
            const { host, seat } = await marketTwoShort()
            host.edit((state) => setBarn(state, { iron: 1 }))
            return { host, seat }
        }
    },
    'guild-alchemist-push': {
        build: () => atGuild(seats(guildSeat('alchemist'), plain, plain))
    },
    'guild-knight-trade': {
        arranged:
            "R-4.6.3, R-4.2.4 Four markers in the seat's Knight row, and pawns on three spaces for the behemoth to choose from: krud barrels fill a row from two to three to six, only pulls and pushes of single markers bring one back to four, and Migrates spread pawns over rounds.",
        build: async () => {
            const { host, seat } = await atGuild(seats(guildSeat('farmer'), plain, plain))
            host.edit((state) => {
                threePawns(state, seat)
                const markers = state.guilds.knight.rows.map((row) => row.markers)
                markers[seatRowIndex(state, seat)] = 4
                setRowMarkers(state, markers)
            })
            return { host, seat }
        }
    },
    'guild-noble-pull': {
        build: () => journeymanAtGuild('noble')
    },
    'guild-monk-trade': {
        build: () => atGuild(seats(guildSeat('farmer'), plain, plain))
    },
    'guild-feast': {
        build: async () => {
            const host = await atCards(
                seats(
                    { goods: Plain, character: 'merchant', space: Desert3 },
                    guildSeat('knight', {
                        goods: ['sulfur', 'iron', 'food'],
                        sulfurToBarrel: true,
                        space: Desert3
                    }),
                    plain
                )
            )
            const seat = second(host)
            await othersForfeitUntil(host, seat)
            return { host, seat }
        }
    },
    'short-with-tile': {
        arranged:
            'R-4.4-H1 No food, no shillings and a region tile: a seat spends its seven of each over rounds, and a tile comes by an Improve with a seal.',
        build: () => shortOfPayment(true)
    },
    'short-no-tile': {
        arranged: 'R-4.4-H1 No food and no shillings: a seat spends its seven of each over rounds.',
        build: () => shortOfPayment(false)
    },
    'reeve-offer': {
        build: () => atGuild(seats(guildSeat('merchant'), plain, plain))
    },
    'writs-at-will': {
        arranged:
            'R-4.4.2 Mandate 5 in hand: writs come from Explore, off a deck the seed orders, and this one is ninth from its top.',
        build: async () => {
            const host = await atCards(seats(plain, plain, plain))
            const seat = first(host)
            host.edit((state) => holdWrit(state, seat, 'writ.mandate.5'))
            return { host, seat }
        }
    },
    'writs-charter-held': {
        build: async () => {
            const { host, seat } = await exploring(['influence', 'explore', 'guild', 'tax'])
            await host.send(seat, { type: ActionType.Explore, revealsInfo: true })
            await host.send(seat, {
                type: ActionType.KeepWrits,
                keep: ['writ.charter.central-kingdom']
            })
            await othersForfeitUntil(host, seat)
            await guildAction(host, seat, 'noble', 'trade', {
                scrollSpaces: ['guild.noble.scroll.r1c1']
            })
            await othersForfeitUntil(host, seat)
            return { host, seat }
        }
    },
    'writs-limit': {
        arranged:
            'R-4.4.4 Three writs held, mandate 5 among them: a seat draws them over Explores in more than one round.',
        build: async () => {
            const { host, seat } = await exploring(['influence', 'explore', 'tax', 'guild'])
            host.edit((state) => {
                for (const writId of [
                    'writ.mandate.5',
                    'writ.mandate.4',
                    'writ.mandate.7'
                ] as const) {
                    holdWrit(state, seat, writId)
                }
            })
            return { host, seat }
        }
    },
    'nourish-choice': {
        arranged:
            'R-4.10.1 Three pawns, one food and one barrel sulfur: two Migrates take two rounds, and a seat eats its seven food over more.',
        build: async () => {
            const host = await atCards(seats(plain, plain, plain))
            const seat = first(host)
            host.edit((state) => {
                threePawns(state, seat)
                holdFood(state, seat, 1)
                fillBarrel(state, seat, 1)
            })
            await forfeitRound(host, seat)
            return { host, seat }
        }
    },
    'dawn-roll': {
        arranged:
            "R-4.11.2, R-4.12 The stacks one roll from epoch II, a serf's landscape and a vassal's feudum: the stacks run down over most of a game.",
        build: async () => {
            const host = await dawnNext((state, [ana, bram]) => {
                tendLandscape(state, bram, ana)
                buildFeudum(state, bram, emptySpace(state, 'town'))
            })
            await forfeitAllButOne(host)
            return { host, seat: first(host) }
        }
    },
    'dawn-collect': {
        arranged:
            'R-4.12.3 Two filled landscapes the seat tends under one ruler, and the stacks one roll from epoch II: the stacks run down over most of a game.',
        build: async () => {
            const host = await dawnNext((state, [ana, bram]) => {
                tendLandscape(state, bram, ana)
                tendLandscape(state, bram, ana)
            })
            await forfeitRound(host)
            return { host, seat: first(host) }
        }
    },
    'game-end': {
        arranged:
            'R-6.1, R-6.3 Epoch IV with a stack empty, the sulfur charter and a seal, and the scores lifted to a tie on vp: the game runs to its end over many rounds.',
        build: async () => {
            const host = await gameEnding(await tyingLifts())
            return { host, seat: first(host) }
        }
    },
    'seals-noble-push': {
        build: async () => {
            const host = await atCards(
                seats(
                    guildSeat('noble', { hand: ['tax', 'harvest', 'migrate', 'guild'] }),
                    guildSeat('farmer'),
                    plain
                )
            )
            const [seat, buyer] = [first(host), second(host)]
            await othersForfeitUntil(host, buyer)
            await guildAction(host, buyer, 'noble', 'trade', {
                scrollSpaces: ['guild.noble.scroll.r1c1']
            })
            await othersForfeitUntil(host, seat)
            return { host, seat }
        }
    },
    'undo-two-cards': {
        build: async () => {
            const host = await atCards(
                seats(
                    {
                        goods: ['sulfur', 'iron', 'food'],
                        character: 'farmer',
                        space: Forest2,
                        hand: ['migrate', 'move', 'tax', 'guild'],
                        pouch: 'sulfur'
                    },
                    plain,
                    plain
                )
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
