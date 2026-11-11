import { assertExists, type GameAction } from '@tabletop/common'
import {
    ActionCards,
    beadValue,
    ChickenSpaces,
    type ChickenSpaceId,
    type ImproveMetadata,
    type SpaceId,
    GuildById,
    isAdvanceTurn,
    isAnswerAttack,
    isAnswerStarve,
    isBeginDawn,
    isChooseFavours,
    isChooseStartingGoods,
    isCollectLandscapes,
    isCommitAttack,
    isConquer,
    isDiscardWrit,
    isEndRound,
    isExplore,
    isFeast,
    isFinaliseHand,
    isForfeitCard,
    isGuildAction,
    isHarvest,
    isImprove,
    isInfluence,
    isKeepWrits,
    isMigrate,
    isMove,
    isNourish,
    isNourishPawns,
    isPlaceDisc,
    isPlaceStartingPawn,
    isPlaceVessel,
    isPlayDefend,
    isPlayMandate,
    isReclaimImmunitySeal,
    isReplenishGuilds,
    isReplenishMap,
    isRollProgressDie,
    isScoreGame,
    isSpendRegionTile,
    isStarveThePeople,
    isStartRound,
    isTax,
    isTendLandscape,
    LocationDiscs,
    MarketSpaces,
    AlchemistCartSpaces,
    GuildRanks,
    type CollectedLandscape,
    type CombatRecord,
    type Good,
    type GoodCounts,
    type GuildFunctionDetails,
    type GuildFunctionOutcome,
    type GuildFunctionParams,
    type GuildId,
    type KnightRowLeft,
    type Migrate,
    type Move,
    type MoveStepRecord,
    type PawnLeft,
    type RankChange,
    type RowFill,
    type SealId,
    type StarveRecord,
    type WildTileSpend,
    type WritId
} from '@tabletop/feudum'
import { regionOf, spaceLabel } from './cardFlows.js'
import { handFaceShown, writFaceShown } from './perspective.js'
import { fillLine, goodsLine } from './roundEnd.js'
import { EpochNames, tileName } from './tileName.js'
import { writName } from './writLabels.js'

/**
 * Who reads a line. A line is built from the Action as this seat received it and from nothing else,
 * so what a projection took out has nowhere to come back from.
 */
export interface ActionLineView {
    readonly viewerId: string | undefined
    /** S57 Host View is its own explicit look at the faces. */
    readonly hostView?: boolean
    readonly nameOf: (playerId: string) => string
}

/** A clause of a line, in the order it reads; nothing when it says nothing. */
type Clause = string | undefined

const Separator = ' · '

function sentence(...clauses: readonly Clause[]): string {
    return clauses.filter((clause) => clause).join(Separator)
}

/** R-1.3 A chicken by its space's number. */
function chickenNumber(space: ChickenSpaceId): number {
    const chicken = ChickenSpaces.find(({ id }) => id === space)
    assertExists(chicken, `R-1.3 There is a chicken ${space}`)
    return chicken.space
}

function plural(count: number, one: string, many = `${one}s`): string {
    return `${count} ${count === 1 ? one : many}`
}

function listed(items: readonly string[]): string {
    return items.join(', ')
}

function spoken(word: string): string {
    return word.replaceAll('-', ' ')
}

function titled(word: string): string {
    return `${word.charAt(0).toUpperCase()}${word.slice(1)}`
}

function article(word: string): string {
    return `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${spoken(word)}`
}

class Words {
    constructor(private readonly view: ActionLineView) {}

    /** A seat as the subject of a sentence: "You moved", "Ana moved". */
    who(playerId: string): string {
        return playerId === this.view.viewerId ? 'You' : this.view.nameOf(playerId)
    }

    /** A seat as an object: "asked you", "asked Ana". */
    whom(playerId: string): string {
        return playerId === this.view.viewerId ? 'you' : this.view.nameOf(playerId)
    }

    /** "your knight", "Ben's knight". */
    whose(playerId: string): string {
        return playerId === this.view.viewerId ? 'your' : `${this.view.nameOf(playerId)}'s`
    }

    /** R-3.1 Asked before the field is read: a Local game holds it and still shows the back. */
    seesHand(actorId: string): boolean {
        return this.view.hostView === true || handFaceShown(this.view.viewerId, actorId)
    }

    /** R-4.4.1, R-4.4.3 Asked before the field is read, for the same reason. */
    seesWrits(actorId: string): boolean {
        return this.view.hostView === true || writFaceShown(this.view.viewerId, actorId)
    }
}

function goodsCounted(goods: readonly Good[]): string {
    return listed(
        [...new Set(goods)].map((good) => `${goods.filter((one) => one === good).length} ${good}`)
    )
}

function countsLine(counts: Readonly<GoodCounts>): string {
    return listed(
        Object.entries(counts)
            .filter(([, count]) => count > 0)
            .map(([good, count]) => `${count} ${good}`)
    )
}

function anyGoods(counts: Readonly<GoodCounts>): boolean {
    return Object.values(counts).some((count) => count > 0)
}

function bead(sealId: SealId): string {
    return `bead +${beadValue(sealId)}`
}

function rank(guildId: GuildId, name: string, sameGuild: boolean): string {
    return sameGuild ? name : `${GuildById[guildId].name} ${name}`
}

/** R-4.5 Named on the Action that caused them; a guild named by the clause before is not repeated. */
function ranksLine(changes: readonly RankChange[] | undefined, words: Words): Clause {
    if (!changes || changes.length === 0) {
        return undefined
    }
    return changes
        .map(({ guildId, playerId, from, to, reeveReturned }, index) => {
            const sameGuild = index > 0 && changes[index - 1].guildId === guildId
            const who = words.who(playerId)
            const reeve = reeveReturned ? ', reeve returned' : ''
            if (!to) {
                return `${who} left the ${GuildById[guildId].name} guild${reeve}`
            }
            const fell = from !== undefined && GuildRanks.indexOf(to) < GuildRanks.indexOf(from)
            return `${who} ${fell ? 'dropped to' : 'became'} ${rank(guildId, to, sameGuild)}${reeve}`
        })
        .join('; ')
}

function wildTilesLine(tiles: readonly WildTileSpend[] | undefined): Clause {
    if (!tiles || tiles.length === 0) {
        return undefined
    }
    return tiles
        .map(
            ({ tileId, good, sulfurToBarrel }) =>
                `used ${tileName(tileId)} for ${good}${sulfurToBarrel ? ' to the barrel' : ''}`
        )
        .join(', ')
}

function cardName(kind: string): string {
    return ActionCards.find((card) => card.kind === kind)?.printedName ?? titled(kind)
}

/** R-3.15, R-3.3-H1 How the card came to be played, when it isn't the plain way. */
function playedAs(action: { asRepeat?: 'repeat' | 'deja-vu'; secondCard?: true }): Clause {
    return sentence(
        action.asRepeat === 'repeat' ? 'by Repeat' : undefined,
        action.asRepeat === 'deja-vu' ? 'by Déjà Vu' : undefined,
        action.secondCard ? 'second card declared' : undefined
    )
}

function writs(actorId: string, ids: () => readonly WritId[] | undefined, words: Words): string {
    if (!words.seesWrits(actorId)) {
        return ''
    }
    const named = ids()
    return named && named.length > 0 ? `: ${listed(named.map(writName))}` : ''
}

/** R-4.4-H2 The count and how many to keep are public; only the actor sees which. */
function drawLine(
    actorId: string,
    drawn: number | undefined,
    keep: number | undefined,
    ids: () => readonly WritId[] | undefined,
    words: Words
): Clause {
    if (!drawn) {
        return undefined
    }
    const toKeep = keep === undefined ? '' : `, to keep ${keep}`
    return `drew ${plural(drawn, 'writ')}${toKeep}${writs(actorId, ids, words)}`
}

function finaliseLine(action: GameAction, words: Words): string | undefined {
    if (!isFinaliseHand(action)) {
        return undefined
    }
    const { playerId } = action
    const cards = words.seesHand(playerId) ? action.cards : undefined
    return sentence(
        `${words.who(playerId)} finalised`,
        action.pouchGood ? `pouch ${action.pouchGood}` : undefined,
        cards && cards.length > 0 ? listed(cards.map(cardName)) : undefined
    )
}

function keepLine(action: GameAction, words: Words): string | undefined {
    if (!isKeepWrits(action)) {
        return undefined
    }
    const { playerId, metadata } = action
    const kept = metadata?.keptCount ?? 0
    const under = metadata?.returnedCount ?? 0
    const seen = words.seesWrits(playerId)
    const keptNames = seen && action.keep ? `: ${listed(action.keep.map(writName))};` : ','
    const underNames =
        seen && metadata?.returned && metadata.returned.length > 0
            ? `: ${listed(metadata.returned.map(({ writId }) => writName(writId)))}`
            : ''
    return sentence(
        `${words.who(playerId)} drew ${kept + under}, kept ${kept}${keptNames} ${under} under the deck${underNames}`,
        metadata?.drawnCount
            ? `Shovels & Swords: ${drawLine(playerId, metadata.drawnCount, metadata.keepNext, () => metadata.drawnWritIds, words)}`
            : action.shovelsAndSwords
              ? 'Shovels & Swords'
              : undefined,
        wildTilesLine(action.wildTiles)
    )
}

function stepPiece(step: Move['steps'][number], record?: MoveStepRecord): string {
    if (step.piece.kind === 'monster') {
        return spoken(step.piece.monsterId)
    }
    return record?.character ?? 'pawn'
}

/** R-4.2 One hop of a path: its way, its fare, and what happened to a vessel. */
function hop(
    { to, medium, vessel, ferry }: Move['steps'][number],
    record: MoveStepRecord | undefined
): string {
    const way = ferry
        ? `ferry${record?.fare ? ` (${record.fare}s)` : ''}`
        : record?.vessel
          ? spoken(record.vessel)
          : spoken(medium)
    const boarded = vessel === 'board' ? ', boarded' : vessel === 'place' ? ', vessel placed' : ''
    const left = record?.left ? `, left the ${spoken(record.left)}` : ''
    return `→ ${spaceLabel(to)} by ${way}${boarded}${left}`
}

/** R-3.7 Consecutive steps of a piece read as one path. */
function pathsLine(action: Move): string {
    const records = action.metadata?.steps ?? []
    const paths: string[] = []
    let current: string | undefined
    let last: string | undefined
    action.steps.forEach((step, index) => {
        const record = records.at(index)
        const key = JSON.stringify(step.piece)
        if (key !== last) {
            if (current) {
                paths.push(current)
            }
            const from = record ? ` ${spaceLabel(record.from)}` : ''
            current = `${stepPiece(step, record)}${from}`
            last = key
        }
        current = `${current} ${hop(step, record)}`
    })
    if (current) {
        paths.push(current)
    }
    return paths.join('; ')
}

function pilferLine(action: Move): Clause {
    const { pilfer, metadata } = action
    if (!pilfer || !metadata?.pilfer) {
        return undefined
    }
    const place = spaceLabel(metadata.pilfer.spaceId)
    const from = pilfer.from === 'space' ? place : `the ${pilfer.from} at ${place}`
    const what =
        pilfer.resource === 'shillings'
            ? '1s'
            : pilfer.resource === 'targets'
              ? 'a target'
              : pilfer.resource
    const became =
        metadata.pilfer.marker === true
            ? ', now a marker'
            : metadata.pilfer.marker === false
              ? ', no marker left'
              : ''
    return `pilfered ${what} from ${from}${became}${pilfer.sulfurToBarrel ? ', to the barrel' : ''}`
}

function moveLine(action: GameAction, words: Words): string | undefined {
    if (!isMove(action)) {
        return undefined
    }
    const godspeed = action.godspeed
    const record = action.metadata?.godspeed
    return sentence(
        `${words.who(action.playerId)} moved ${pathsLine(action)}`,
        godspeed
            ? `Godspeed: ${record?.character ?? 'pawn'}${record ? ` ${spaceLabel(record.from)}` : ''} ${hop(
                  {
                      ...godspeed,
                      piece: { kind: 'pawn', playerId: action.playerId, n: godspeed.pawn }
                  },
                  record
              )}`
            : undefined,
        pilferLine(action),
        ranksLine(action.metadata?.rankChanges, words),
        playedAs(action)
    )
}

function migrateOnto(action: Migrate): string {
    const left = action.metadata?.left
    const off = left ? `the ${left.character} off ${spaceLabel(left.spaceId)}` : undefined
    if (action.onto === 'off') {
        return off ?? 'a pawn off the board'
    }
    const onto = `${article(action.onto.character)} onto ${spaceLabel(action.onto.spaceId)}`
    return off ? `${off} and ${onto}` : onto
}

function migrateLine(action: GameAction, words: Words): string | undefined {
    if (!isMigrate(action)) {
        return undefined
    }
    const left = action.metadata?.left
    return sentence(
        `${words.who(action.playerId)} migrated ${migrateOnto(action)}`,
        left?.vessel ? `${spoken(left.vessel)} left at ${spaceLabel(left.spaceId)}` : undefined,
        left?.wine ? 'its sulfur to the haversack' : undefined,
        action.distantKin ? 'Distant Kin' : undefined,
        wildTilesLine(action.wildTiles),
        ranksLine(action.metadata?.rankChanges, words),
        playedAs(action)
    )
}

function influenceLine(action: GameAction, words: Words): string | undefined {
    if (!isInfluence(action)) {
        return undefined
    }
    const placements = action.metadata?.placements ?? []
    const named = placements.map(({ spaceId, role, displacedPlayerId }) => {
        const out = displacedPlayerId ? ` (displacing ${words.whom(displacedPlayerId)})` : ''
        return `${role} of ${spaceLabel(spaceId)}${out}`
    })
    return sentence(
        `${words.who(action.playerId)} placed ${plural(placements.length, 'marker')}${
            named.length > 0 ? `: ${listed(named)}` : ''
        }`,
        action.moneyIsInfluence
            ? `Money is Influence at ${spaceLabel(action.moneyIsInfluence)}`
            : undefined,
        ranksLine(action.metadata?.rankChanges, words),
        playedAs(action)
    )
}

function discFaces(discId: string): Clause {
    const disc = LocationDiscs.find(({ id }) => id === discId)
    if (!disc) {
        return undefined
    }
    return 'faces' in disc && disc.faces.a !== disc.faces.b
        ? `disc ${disc.faces.a}/${disc.faces.b}`
        : undefined
}

/** R-4.3.1, R-4.3.2 No tile taken: the stack is empty, or its top is of a later epoch and stays. */
function untakenTile(spaceId: SpaceId, noTile: ImproveMetadata['noTile']): string {
    return noTile === 'empty'
        ? 'no tile left'
        : `${titled(regionOf(spaceId))} tile not yet legal, none taken`
}

function improveLine(action: GameAction, words: Words): string | undefined {
    if (!isImprove(action)) {
        return undefined
    }
    const place = spaceLabel(action.spaceId)
    const { metadata } = action
    const who = words.who(action.playerId)
    if (!metadata) {
        return sentence(`${who} improved ${place}`, playedAs(action))
    }
    const guild = action.feudumGuild ? ` (${GuildById[action.feudumGuild].name})` : ''
    const tile = metadata.tile
    return sentence(
        `${who} improved ${place} from ${metadata.from} to ${metadata.to}${guild}`,
        discFaces(metadata.discId),
        metadata.goodsToHaversack && anyGoods(metadata.goodsToHaversack)
            ? `${countsLine(metadata.goodsToHaversack)} to the haversack`
            : undefined,
        tile
            ? `took ${tileName(tile.tileId)} (${spoken(tile.landscape)})${action.fallbackRegion ? ' as fallback' : ''}`
            : untakenTile(action.spaceId, metadata.noTile),
        tile && tile.vp > 0 ? `+${tile.vp} vp` : undefined,
        ranksLine(metadata.rankChanges, words),
        playedAs(action)
    )
}

function collectedLine(
    { kept, paid, rulerId, seatMarkers, rulerMarkers }: CollectedLandscape['collected'],
    words: Words
): string {
    const markers =
        seatMarkers !== undefined || rulerMarkers !== undefined
            ? `, markers ${seatMarkers ?? 0} and ${rulerMarkers ?? 0}`
            : ''
    return `kept ${kept}, paid ${words.whom(rulerId)} ${paid}${markers}`
}

function tendLine(action: GameAction, words: Words): string | undefined {
    if (!isTendLandscape(action)) {
        return undefined
    }
    const { metadata } = action
    const place = spaceLabel(action.spaceId)
    const landscape = metadata ? spoken(metadata.landscape) : 'landscape'
    const collected = metadata?.collected
    return sentence(
        `${words.who(action.playerId)} tended the ${landscape} at ${place}`,
        metadata ? `filled ${metadata.filled}` : undefined,
        metadata && metadata.vp > 0 ? `+${metadata.vp} vp` : undefined,
        collected ? `collected: ${collectedLine(collected, words)}` : 'left it lying',
        ranksLine(metadata?.rankChanges, words),
        playedAs(action)
    )
}

function beadsFlippedLine(count: number): Clause {
    return count > 0 ? `${plural(count, 'bead')} flipped` : undefined
}

function harvestLine(action: GameAction, words: Words): string | undefined {
    if (!isHarvest(action)) {
        return undefined
    }
    const { metadata } = action
    const who = words.who(action.playerId)
    return sentence(
        `${who} harvested ${spaceLabel(action.spaceId)}`,
        metadata ? `drew ${countsLine(metadata.drawn) || 'nothing'}` : undefined,
        metadata && metadata.vp > 0 ? `+${metadata.vp} vp` : undefined,
        metadata?.favours && anyGoods(metadata.favours)
            ? `favours ${countsLine(metadata.favours)}`
            : undefined,
        metadata ? beadsFlippedLine(metadata.beadsFlipped) : undefined,
        playedAs(action)
    )
}

function favoursLine(action: GameAction, words: Words): string | undefined {
    if (!isChooseFavours(action)) {
        return undefined
    }
    const favours = action.metadata?.favours ?? action.favours
    const who = words.who(action.playerId)
    return favours && anyGoods(favours)
        ? sentence(
              `${who} took favours ${countsLine(favours)}`,
              action.metadata ? beadsFlippedLine(action.metadata.beadsFlipped) : undefined,
              action.sulfurToBarrel ? `${action.sulfurToBarrel} sulfur to the barrel` : undefined
          )
        : `${who} took no favours`
}

function taxLine(action: GameAction, words: Words): string | undefined {
    if (!isTax(action)) {
        return undefined
    }
    const { metadata } = action
    const from =
        metadata?.reinforcements === 'knight-row'
            ? 'Reinforcements marker from the Knight row'
            : metadata?.reinforcements === 'general-supply'
              ? 'Reinforcements marker from the general supply'
              : action.collect === false
                ? 'declined Reinforcements'
                : undefined
    return sentence(
        `${words.who(action.playerId)} taxed${metadata ? ` ${metadata.shillings}s` : ''}`,
        from,
        ranksLine(metadata?.rankChanges, words),
        playedAs(action)
    )
}

/** R-4.8 The strengths, who won, the points and what went home. */
function combatLine(combat: CombatRecord | undefined, words: Words): readonly Clause[] {
    if (!combat) {
        return []
    }
    const { attack, defence, attackerWins, vp, conquered, defenderId } = combat
    return [
        `attack ${attack.total}, defence ${defence.total}: ${attackerWins ? 'the attack won' : 'the defence held'}`,
        vp > 0 ? `+${vp} vp` : undefined,
        conqueredLine(conquered, defenderId, combat.spaceId, words),
        ranksLine(combat.rankChanges, words)
    ]
}

function conqueredLine(
    conquered: CombatRecord['conquered'],
    defenderId: string,
    spaceId: CombatRecord['spaceId'],
    words: Words
): Clause {
    if (!conquered) {
        return undefined
    }
    switch (conquered.kind) {
        case 'pawn':
            return sentence(
                `${words.whose(defenderId)} ${conquered.character} went home`,
                conquered.vessel
                    ? `${spoken(conquered.vessel)} left at ${spaceLabel(spaceId)}`
                    : undefined,
                conquered.wine ? 'its sulfur to the haversack' : undefined
            )
        case 'monster':
            return `${words.whose(defenderId)} ${spoken(conquered.monsterId)} went home`
        case 'feudum': {
            const home = conquered.markersHome.map(
                ({ playerId, count }) => `${words.whom(playerId)} ${count}`
            )
            return sentence(
                `the feudum at ${spaceLabel(spaceId)} fell to an outpost`,
                home.length > 0 ? `markers home: ${listed(home)}` : undefined,
                conquered.newRulerId
                    ? `${words.who(conquered.newRulerId)} became ruler of the outpost`
                    : undefined
            )
        }
    }
}

function conquerLine(action: GameAction, words: Words): string | undefined {
    if (!isConquer(action)) {
        return undefined
    }
    const { target, metadata, spaceId } = action
    const defenderId = metadata?.defenderId
    const whose = defenderId ? words.whose(defenderId) : 'the'
    const piece =
        target.kind === 'monster'
            ? spoken(target.monsterId)
            : target.kind === 'feudum'
              ? 'feudum'
              : (metadata?.character ?? 'pawn')
    const asked =
        metadata?.asked && defenderId ? ` and asked ${words.whom(defenderId)} to answer` : ''
    return sentence(
        `${words.who(action.playerId)} attacked ${whose} ${piece} at ${spaceLabel(spaceId)}${asked}`,
        playedAs(action),
        ...combatLine(metadata?.combat, words)
    )
}

function answerLine(action: GameAction, words: Words): string | undefined {
    if (!isAnswerAttack(action)) {
        return undefined
    }
    const who = words.who(action.playerId)
    const vp = action.metadata?.vp ?? 0
    return sentence(
        action.flipDefend ? `${who} flipped Defend` : `${who} let it stand`,
        vp > 0 ? `+${vp} vp` : undefined,
        ...combatLine(action.metadata?.combat, words)
    )
}

function commitLine(action: GameAction, words: Words): string | undefined {
    if (!isCommitAttack(action)) {
        return undefined
    }
    const { metadata, saltpeter, weapons } = action
    const named = weapons.map(({ writId }) => {
        const strength = metadata?.weaponStrengths.find((one) => one.writId === writId)
        return `${writName(writId)}${strength ? ` (+${strength.attack} attack)` : ''}`
    })
    const added = [...(saltpeter > 0 ? [`${saltpeter} saltpeter`] : []), ...named]
    return sentence(
        `${words.who(action.playerId)} added ${added.length > 0 ? added.join(' and ') : 'nothing'}`,
        wildTilesLine(action.wildTiles),
        ...combatLine(metadata, words)
    )
}

function starvedLine(starved: StarveRecord | undefined, words: Words): readonly Clause[] {
    if (!starved) {
        return []
    }
    return [
        `${plural(starved.beads.length, 'chicken bead')} returned`,
        ranksLine(starved.rankChanges, words)
    ]
}

function starveLine(action: GameAction, words: Words): string | undefined {
    if (!isStarveThePeople(action)) {
        return undefined
    }
    const asked = action.metadata?.asked
        ? ` and asked ${words.whom(action.targetPlayerId)} to answer`
        : ''
    return sentence(
        `${words.who(action.playerId)} starved ${words.whose(action.targetPlayerId)} ${action.role} at ${spaceLabel(action.spaceId)}${asked}`,
        playedAs(action),
        ...starvedLine(action.metadata?.starved, words)
    )
}

function answerStarveLine(action: GameAction, words: Words): string | undefined {
    if (!isAnswerStarve(action)) {
        return undefined
    }
    const who = words.who(action.playerId)
    const place = action.metadata ? ` at ${spaceLabel(action.metadata.spaceId)}` : ''
    return sentence(
        action.royalImmunity ? `${who} played Royal Immunity${place}` : `${who} let it go`,
        wildTilesLine(action.wildTiles),
        ...starvedLine(action.metadata?.starved, words)
    )
}

function marketSpaceName(spaceId: string): string {
    const space = MarketSpaces.find(({ id }) => id === spaceId)
    return space ? `${space.good} ${space.space}` : 'a space'
}

function cartSpaceName(spaceId: string): string {
    const space = AlchemistCartSpaces.find(({ id }) => id === spaceId)
    return space ? `${space.good} ${space.space}` : 'a space'
}

function countsOf(rows: number, columns: number, count?: 'rows' | 'columns'): string {
    const both = `${plural(rows, 'row')}, ${plural(columns, 'column')}`
    return count ? `${both}, counting ${count}` : both
}

function rowName({ colour, playerId }: KnightRowLeft | RowFill, words: Words): string {
    return playerId ? `${words.whose(playerId)} row` : `the ${colour} row`
}

/** R-4.6 What a function moved, and where; R-5-H1 a seal is named only when it flips to a bead. */
function detailsLine(
    details: GuildFunctionDetails,
    params: GuildFunctionParams,
    words: Words
): string {
    switch (details.kind) {
        case 'farmer-trade':
            return sentence(
                `sent ${countsLine(details.sent)} for ${details.food} food, ${details.shillings}s`,
                anyGoods(details.toBarn) ? `barn ${countsLine(details.toBarn)}` : undefined,
                anyGoods(details.toMarket) ? `market ${countsLine(details.toMarket)}` : undefined,
                anyGoods(details.toCarts) ? `carts ${countsLine(details.toCarts)}` : undefined,
                anyGoods(details.toHaversack)
                    ? `spilt ${countsLine(details.toHaversack)}`
                    : undefined
            )
        case 'farmer-pull':
        case 'monk-push':
            return `drew ${bead(details.bead)} for chicken ${chickenNumber(details.chicken)}, now ${details.chickenSum}`
        case 'farmer-push':
            return sentence(
                `filled ${listed(details.spaces.map(marketSpaceName))} on the market`,
                countsOf(details.rows, details.columns, details.count)
            )
        case 'merchant-trade':
            return `bought ${listed(details.bought.map(({ good, price }) => `${good} (${price}s)`))} for ${details.price}s`
        case 'merchant-pull':
            return sentence(
                `filled ${listed(details.spaces.map(marketSpaceName))} on the market`,
                countsOf(details.rows, details.columns)
            )
        case 'merchant-push':
        case 'alchemist-pull':
            return sentence(
                `moved ${listed(details.moves.map(({ from, to }) => `${marketSpaceName(from)} → cart ${cartSpaceName(to)}`))}`,
                details.completed.length > 0 ? `completed ${listed(details.completed)}` : undefined
            )
        case 'alchemist-trade':
            return `bought ${params.vesselType ? article(params.vesselType) : 'a vessel'} for ${details.price}s`
        case 'alchemist-push':
        case 'knight-pull':
            return sentence(
                `turned in ${countsLine(details.goodsUsed)}`,
                params.inventions ? `invented ${listed(params.inventions.map(spoken))}` : undefined,
                details.barrels.length > 0
                    ? `barrels: ${listed(
                          details.barrels
                              .flat()
                              .map((fill) => `${rowName(fill, words)} +${fill.added}`)
                      )}`
                    : undefined
            )
        case 'knight-trade':
            return sentence(
                `took ${plural(details.taken, 'marker')}, kept ${details.kept}, paid ${details.price}s`,
                params.monster
                    ? `tamed the ${spoken(params.monster)}${params.deploySpaceId ? ` at ${spaceLabel(params.deploySpaceId)}` : ''}`
                    : undefined
            )
        case 'knight-push':
            return sentence(
                `markers left ${listed(details.markers.map((row) => rowName(row, words)))}`,
                countsOf(details.rows, details.columns, details.count)
            )
        case 'noble-trade':
            return `bought ${plural(params.scrollSpaces?.length ?? 0, 'seal')} for ${details.price}s`
        case 'noble-pull':
            return sentence(
                `markers left ${listed(details.markers.map((row) => rowName(row, words)))}`,
                countsOf(details.rows, details.columns)
            )
        case 'noble-push':
        case 'monk-pull':
            return sentence(
                details.sealIds.length === 1
                    ? `flipped a seal to ${bead(details.sealIds[0])}`
                    : `flipped seals to ${listed(details.sealIds.map(bead))}`,
                `rosary now ${details.rosaryTotal}`
            )
        case 'monk-trade':
            return `kept ${bead(details.bead)}, paid ${details.price}s`
    }
}

function paidLine(outcome: GuildFunctionOutcome, words: Words): Clause {
    const { payment, split } = outcome
    if (payment) {
        return `paid ${listed([
            ...payment.members.map(({ playerId, amount }) => `${words.whom(playerId)} ${amount}s`),
            ...(payment.charity.amount > 0 ? [`charity ${payment.charity.amount}s`] : []),
            ...(payment.generalSupply > 0 ? [`general supply ${payment.generalSupply}s`] : [])
        ])}`
    }
    if (split) {
        return `shared ${listed(split.shares.map(({ playerId, amount }) => `${words.whom(playerId)} ${amount}`))}${
            split.stays > 0 ? `, ${split.stays} stays` : ''
        }`
    }
    return undefined
}

function outcomeLine(
    actorId: string,
    outcome: GuildFunctionOutcome,
    params: GuildFunctionParams,
    words: Words
): readonly Clause[] {
    return [
        detailsLine(outcome.details, params, words),
        outcome.completions === undefined ? undefined : plural(outcome.completions, 'completion'),
        outcome.points > 0 ? `+${outcome.points} vp` : undefined,
        paidLine(outcome, words),
        outcome.reevePoints > 0 ? `reeve +${outcome.reevePoints} vp` : undefined,
        drawLine(actorId, outcome.drawnCount, outcome.keep, () => outcome.drawnWritIds, words),
        ranksLine(outcome.rankChanges, words)
    ]
}

function guildLine(action: GameAction, words: Words): string | undefined {
    if (!isGuildAction(action)) {
        return undefined
    }
    const head = `${words.who(action.playerId)} used ${GuildById[action.guildId].name} ${action.fn}`
    const { metadata } = action
    if (!metadata) {
        return sentence(head, playedAs(action))
    }
    const [details, ...rest] = outcomeLine(action.playerId, metadata, action.params, words)
    return sentence(`${head}: ${details}`, ...rest, playedAs(action))
}

function feastLine(action: GameAction, words: Words): string | undefined {
    if (!isFeast(action)) {
        return undefined
    }
    const { metadata } = action
    const head = `${words.who(action.playerId)} feasted with ${words.whom(action.opponentId)} at ${spaceLabel(action.spaceId)}`
    if (!metadata) {
        return sentence(head, playedAs(action))
    }
    const [details, ...rest] = outcomeLine(action.playerId, metadata, action.params, words)
    return sentence(
        `${head}, using ${GuildById[action.guildId].name} ${metadata.fn}: ${details}`,
        ...rest,
        metadata.feastPoints > 0 ? `feast +${metadata.feastPoints} vp` : undefined,
        playedAs(action)
    )
}

function discLine(action: GameAction, words: Words): string | undefined {
    if (!isPlaceDisc(action)) {
        return undefined
    }
    const { metadata, playerId } = action
    const who = words.who(playerId)
    if (!metadata || !action.place) {
        return `${who} kept the disc`
    }
    switch (metadata.disc) {
        case 'reeve':
            return sentence(
                `${who} placed a reeve on the ${metadata.guildId ? GuildById[metadata.guildId].name : ''} guild`,
                metadata.reevePoints ? `+${metadata.reevePoints} vp` : undefined
            )
        case 'military':
            return `${who} took service space ${metadata.space}`
        case 'voyage':
            return sentence(
                `${who} took voyage space ${metadata.space}`,
                drawLine(
                    playerId,
                    metadata.drawnCount,
                    undefined,
                    () => metadata.drawnWritIds,
                    words
                )
            )
    }
}

function mandateReceived(action: GameAction): Clause {
    if (!isPlayMandate(action) || !action.metadata) {
        return undefined
    }
    const { received } = action.metadata
    switch (received.kind) {
        case 'shillings':
            return `${received.amount}s`
        case 'goods':
            return goodsCounted(received.goods)
        case 'vessel':
            return article(received.vessel)
        case 'influence':
            return plural(received.amount, 'marker')
        case 'seal':
            return plural(received.amount, 'seal')
        case 'bead':
            return listed(received.sealIds.map(bead))
    }
}

function mandateLine(action: GameAction, words: Words): string | undefined {
    if (!isPlayMandate(action)) {
        return undefined
    }
    const received = mandateReceived(action)
    return sentence(
        `${words.who(action.playerId)} played ${writName(action.writId)}${received ? ` for ${received}` : ''}`,
        action.rewardGuild ? `${GuildById[action.rewardGuild].name} reward` : undefined,
        wildTilesLine(action.wildTiles),
        ranksLine(action.metadata?.rankChanges, words)
    )
}

function leftLine(returned: readonly { readonly left: PawnLeft }[]): Clause {
    return returned.length > 0
        ? `unfed: ${listed(
              returned.map(
                  ({ left }) => `the ${left.character} from ${spaceLabel(left.spaceId)} returned`
              )
          )}`
        : undefined
}

function nourishLine(action: GameAction, words: Words): string | undefined {
    if (!isNourish(action)) {
        return undefined
    }
    const { metadata, wineFed } = action
    return sentence(
        `${words.who(action.playerId)} fed ${metadata?.foodFed.length ?? 0} food, ${wineFed.length} wine`,
        wildTilesLine(action.wildTiles),
        metadata ? leftLine(metadata.returned) : undefined,
        ranksLine(metadata?.rankChanges, words)
    )
}

function nourishPawnsLine(action: GameAction, words: Words): string | undefined {
    if (!isNourishPawns(action)) {
        return undefined
    }
    const fed = action.metadata?.fed ?? []
    if (fed.length === 0) {
        return 'No pawn needed feeding'
    }
    const ate = fed
        .map(({ playerId, wineFed, foodFed, returned }) =>
            sentence(
                `${words.who(playerId)} ${foodFed.length} food, ${wineFed.length} wine`,
                leftLine(returned)
            )
        )
        .join('; ')
    return sentence(`Pawns ate: ${ate}`, ranksLine(action.metadata?.rankChanges, words))
}

function collectLine(action: GameAction, words: Words): string | undefined {
    if (!isCollectLandscapes(action)) {
        return undefined
    }
    const who = words.who(action.playerId)
    const collections = action.metadata?.collections ?? []
    if (collections.length === 0) {
        return `${who} left every landscape`
    }
    const named = collections.map(
        ({ spaceId, landscape, collected }) =>
            `the ${spoken(landscape)} at ${spaceLabel(spaceId)}: ${collectedLine(collected, words)}`
    )
    return sentence(
        `${who} collected ${named.join('; ')}`,
        ranksLine(action.metadata?.rankChanges, words)
    )
}

function dieLine(action: GameAction): string | undefined {
    if (!isRollProgressDie(action)) {
        return undefined
    }
    const { metadata } = action
    if (!metadata || metadata.faces.length === 0) {
        return 'The progress die was not rolled'
    }
    return sentence(
        `The progress die rolled ${listed(metadata.faces.map(titled))}`,
        metadata.removed ? `${tileName(metadata.removed.tileId)} removed` : undefined,
        metadata.epochTriggered ? `Epoch ${EpochNames[metadata.epochTriggered]} dawned` : undefined
    )
}

function dawnLine(action: GameAction, words: Words): string | undefined {
    if (!isBeginDawn(action)) {
        return undefined
    }
    const { metadata } = action
    if (!metadata) {
        return 'Dawn began'
    }
    const rows = metadata.sheet.map(
        ({ playerId, ranks, landscapes, activeRegions, disloyaltyVp, total }) => {
            const rankVp = ranks.reduce((sum, { vp }) => sum + vp, 0)
            return `${words.who(playerId)} ${total >= 0 ? '+' : ''}${total} vp (ranks ${rankVp}, landscapes ${landscapes.vp}, regions ${activeRegions.vp}, disloyalty ${disloyaltyVp})`
        }
    )
    return sentence(
        `Dawn of epoch ${EpochNames[metadata.epoch]}: ${rows.join('; ')}`,
        metadata.fills.length > 0 ? listed(metadata.fills.map(fillLine).map(spoken)) : undefined
    )
}

function refillLine(action: GameAction): string | undefined {
    if (!isReplenishGuilds(action)) {
        return undefined
    }
    const { metadata } = action
    if (!metadata) {
        return 'The guilds refilled'
    }
    const parts: readonly (readonly [string, number])[] = [
        ['market good', metadata.market.length],
        ['cart good', metadata.carts.length],
        ['vessel', metadata.vessels.length],
        ['knight marker', metadata.knightRows.reduce((sum, { added }) => sum + added, 0)],
        ['seal', metadata.scrolls.length],
        ['barn good', metadata.barn.length]
    ]
    const beads = [...metadata.rosary, ...metadata.chickens.map(({ bead: sealId }) => sealId)]
    return sentence(
        `The guilds refilled: ${
            listed(
                parts.filter(([, count]) => count > 0).map(([name, count]) => plural(count, name))
            ) || 'nothing'
        }`,
        beads.length > 0 ? `beads flipped: ${listed(beads.map(bead))}` : undefined
    )
}

function advanceLine(action: GameAction, words: Words): string | undefined {
    if (!isAdvanceTurn(action)) {
        return undefined
    }
    const seat = action.metadata?.turnPlayerId
    switch (action.metadata?.outcome) {
        case 'second-card':
            return seat
                ? `The turn stayed with ${words.whom(seat)} for the second card`
                : 'The turn stayed'
        case 'last-card':
            return 'Every card was played'
        default:
            return seat ? `The turn passed to ${words.whom(seat)}` : 'The turn passed'
    }
}

function endRoundLine(action: GameAction, words: Words): string | undefined {
    if (!isEndRound(action)) {
        return undefined
    }
    const { metadata } = action
    if (!metadata) {
        return 'The round ended'
    }
    const paid = metadata.pouchesPaid.map(({ playerId, good }) => `${words.who(playerId)} ${good}`)
    return sentence(
        'The round ended',
        paid.length > 0 ? `pouches paid: ${listed(paid)}` : undefined,
        metadata.sobered.length > 0
            ? `${plural(metadata.sobered.length, 'pawn')} sobered`
            : undefined,
        `start player passed to ${words.whom(metadata.startingPlayerId)}`
    )
}

/** R-6.2, R-4.4.3 Each sealed charter is revealed here, in the record itself, to everyone. */
function scoreLine(action: GameAction, words: Words): string | undefined {
    if (!isScoreGame(action)) {
        return undefined
    }
    const { metadata } = action
    if (!metadata) {
        return 'The game was scored'
    }
    const rows = metadata.sheet.map(
        ({ playerId, voyage, largeEmpire, shillings, charters, score }) => {
            const parts = [
                `voyage ${voyage.vp}`,
                `empire ${largeEmpire.vp}`,
                `shillings ${shillings.vp}`,
                ...charters.map(({ writId, vp }) => `${writName(writId)} +${vp}`)
            ]
            return `${words.who(playerId)} ${score} (${listed(parts)})`
        }
    )
    const tie = metadata.barrelTieBreak?.map(
        ({ playerId, barrel }) => `${words.who(playerId)} ${barrel}`
    )
    return sentence(
        `Final scores: ${rows.join('; ')}`,
        tie ? `tie broken by barrel sulfur: ${listed(tie)}` : undefined,
        metadata.winners.length > 0
            ? `won by ${listed(metadata.winners.map((id) => words.who(id)))}`
            : undefined
    )
}

function plainLine(action: GameAction, words: Words): string | undefined {
    if (isChooseStartingGoods(action)) {
        return sentence(
            `${words.who(action.playerId)} chose ${goodsCounted(action.goods)}`,
            action.sulfurToBarrel ? 'sulfur to the barrel' : undefined
        )
    }
    if (isPlaceStartingPawn(action)) {
        return sentence(
            `${words.who(action.playerId)} placed ${article(action.character)} at ${spaceLabel(action.spaceId)}`,
            ranksLine(action.metadata?.rankChanges, words)
        )
    }
    if (isForfeitCard(action)) {
        return sentence(
            `${words.who(action.playerId)} forfeited ${cardName(action.kind)}`,
            playedAs(action)
        )
    }
    if (isPlayDefend(action)) {
        const vp = action.metadata?.vp ?? 0
        return sentence(
            `${words.who(action.playerId)} played Defend`,
            vp > 0 ? `+${vp} vp` : undefined,
            playedAs(action)
        )
    }
    if (isExplore(action)) {
        const { metadata, playerId } = action
        // R-4.4-H2 An empty deck gives nothing to draw.
        const drew =
            metadata &&
            (drawLine(
                playerId,
                metadata.drawnCount,
                metadata.keep,
                () => metadata.drawnWritIds,
                words
            ) ??
                'explored: the deck had no writ')
        return sentence(`${words.who(playerId)} ${drew ?? 'explored'}`, playedAs(action))
    }
    if (isDiscardWrit(action)) {
        // R-4.4.4 A discard goes under face down: named to its discarder alone.
        const who = words.who(action.playerId)
        return words.seesWrits(action.playerId) && action.writId
            ? `${who} discarded ${writName(action.writId)} under the deck`
            : `${who} discarded a writ under the deck`
    }
    if (isReclaimImmunitySeal(action)) {
        return `${words.who(action.playerId)} took back the Royal Immunity seal from the ${action.role} at ${spaceLabel(action.spaceId)}`
    }
    if (isSpendRegionTile(action)) {
        return `${words.who(action.playerId)} used ${tileName(action.tileId)} for ${action.good}${action.sulfurToBarrel ? ' to the barrel' : ''}`
    }
    if (isPlaceVessel(action)) {
        const at = action.metadata ? ` at ${spaceLabel(action.metadata.spaceId)}` : ''
        return `${words.who(action.playerId)} placed ${article(action.vesselType)}${at}`
    }
    if (isReplenishMap(action)) {
        const goods = action.metadata?.goods ?? []
        return goods.length > 0 ? goodsLine(goods) : 'No new goods'
    }
    if (isStartRound(action)) {
        const { metadata } = action
        return sentence(
            metadata ? `Round ${metadata.round} began` : 'The round began',
            metadata && metadata.drunk.length > 0
                ? `${plural(metadata.drunk.length, 'pawn')} drunk`
                : undefined
        )
    }
    return undefined
}

const Writers: readonly ((action: GameAction, words: Words) => string | undefined)[] = [
    plainLine,
    finaliseLine,
    keepLine,
    moveLine,
    migrateLine,
    influenceLine,
    improveLine,
    tendLine,
    harvestLine,
    favoursLine,
    taxLine,
    conquerLine,
    answerLine,
    commitLine,
    starveLine,
    answerStarveLine,
    guildLine,
    feastLine,
    discLine,
    mandateLine,
    nourishLine,
    nourishPawnsLine,
    collectLine,
    (action) => dieLine(action),
    dawnLine,
    (action) => refillLine(action),
    advanceLine,
    endRoundLine,
    scoreLine
]

/**
 * R-X.1 The log's line for an Action (contract: Game log and history): past tense after the name,
 * "You" for whoever looks, spaces as region and number. Undefined for a type that isn't this game's.
 */
export function describeAction(action: GameAction, view: ActionLineView): string | undefined {
    const words = new Words(view)
    for (const write of Writers) {
        const line = write(action, words)
        if (line) {
            return line
        }
    }
    return undefined
}
