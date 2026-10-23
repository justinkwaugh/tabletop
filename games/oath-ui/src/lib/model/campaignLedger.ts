import {
    BattlePlanSide,
    CampaignTargetKind,
    forceTotal,
    hospitalHolderOf,
    isAnswerConsent,
    isAnswerQuestion,
    isCampaign,
    isCampaignAttackPlans,
    isCampaignDefeatKills,
    isCampaignDefend,
    isCampaignResolveVictory,
    isCampaignSacrifice,
    isCampaignSkullLosses,
    relicDefenseDice,
    takeFromGroups,
    type CampaignKillPath,
    type CampaignPlacement,
    type CampaignResolveVictory,
    type CampaignRollRecord,
    type CampaignTarget,
    type HeldForHospital,
    type HydratedOathGameState,
    type LossSource,
    type RolledAttackFace,
    type RolledDefenseFace,
    type WarbandGroup,
    type WarbandOwner
} from '@tabletop/oath'
import { assertExists, type GameAction } from '@tabletop/common'
import {
    cardNote,
    historyText,
    hospitalPlacedWords,
    namedNote,
    namedWarbandOwner,
    planName,
    recordedHospitalPlaced,
    recordedNotes,
    warbandPlaces,
    type HistoryNames,
    type WarbandReader
} from '$lib/model/actionDescription.js'
import { bannerName, cardName, listed, plural, warbandsOf } from '$lib/model/names.js'
import type { WarbandWhose } from '$lib/model/tokenText.js'

/** R-5.5.4 — how the defense was made up: the shields (and any doubling), the warbands, the bandits. */
export interface DefenseMakeup {
    shields: number
    doublings: number
    doubled: number
    warbands: number
    bandits: number
    defense: number
}

/** One side of a Campaign as its closing card tells it; each line naming seats by id. */
export interface CampaignLedgerSide {
    /** The side's seat; none for the bandits. */
    seatId: string | undefined
    role: 'attacked' | 'defended'
    dice: string
    attackFaces?: readonly RolledAttackFace[]
    defenseFaces?: readonly RolledDefenseFace[]
    makeup?: DefenseMakeup
    plan?: string
    lost?: string
    gained?: string
}

export interface CampaignLedger {
    result: string
    sides: readonly [CampaignLedgerSide, CampaignLedgerSide]
}

/** A plan note as the card that wrote it and what it did. */
type PlanNote = { card: string; text: string }

/** Some of a side's warbands, lost for one reason: "to skulls", "sacrificed", "at Plains". */
type Loss = { count: number; reason: string }

type Pools = { attack: number; defense: number }

// R-5.5.3 — the notes of plans that kill or sacrifice a side's warbands, or gain them something.
const KILLED_ON_BOARD = /^killed (a|an|one|\d+) warbands? on (.+?)['’]s board$/
const SACRIFICED = /^sacrificed (a|an|one|\d+) warbands? /
const GAINED = /^(\S+) gained (.+)$/

/**
 * The steps of the Campaign a closing step ends: from its declaration to that step; and, when a
 * banish waited on an answer (R-5.5.7.III), the answer that ended it, for what Hospital placed then.
 */
export function campaignStepsTo(actions: readonly GameAction[], closingIndex: number): GameAction[] {
    let declared = closingIndex
    while (declared > 0 && !isCampaign(actions[declared])) declared -= 1
    const steps = actions.slice(declared, closingIndex + 1)
    if (!isCampaignResolveVictory(actions[closingIndex])) return steps
    const later = actions.slice(closingIndex + 1)
    const next = later.findIndex(isCampaign)
    const ending = (next < 0 ? later : later.slice(0, next)).find(
        (action) => isAnswerQuestion(action) && action.metadata?.hospitalPlaced !== undefined
    )
    return ending ? [...steps, ending] : steps
}

/**
 * R-5.5 — the Campaign's ledger from its own records: the result, then each side's dice, plans,
 * losses and gains. From revision 25 the closing sacrifice records the dice as rolled and the
 * defense's makeup; before it, the ledger has neither. Warbands Hospital set aside and placed on its
 * site are not lost: the Lost line says where they went, in the History row's words. `state` is the
 * game (the reader's view), for whose Hospital held which warbands (R-10.28-H2).
 */
export function campaignLedger(
    campaignSteps: readonly GameAction[],
    names: HistoryNames,
    state?: HydratedOathGameState
): CampaignLedger {
    // The battle to its closing step; an answer that ended it later adds only Hospital's placement.
    const closedAt = campaignSteps.findLastIndex(
        (step) => isCampaignSacrifice(step) || isCampaignResolveVictory(step)
    )
    const steps = campaignSteps.slice(0, closedAt + 1)
    const declaration = steps.find(isCampaign)
    assertExists(declaration, 'a Campaign’s steps start with its declaration')
    const sacrifice = steps.find(isCampaignSacrifice)
    const closing = sacrifice?.metadata
    assertExists(closing, 'a Campaign closes on its sacrifice step')
    const spoils = steps.find(isCampaignResolveVictory)
    const won = closing.attackerVictorious

    const attackerId = declaration.playerId
    const defenderId =
        declaration.defender.kind === 'player' ? declaration.defender.playerId : undefined
    const defends = steps.filter(isCampaignDefend)
    const attackerSeats = [attackerId]
    const defenderSeats = unique([
        ...(defenderId ? [defenderId] : []),
        ...defends.map((step) => step.playerId)
    ])

    const laterPlans = steps.flatMap((step) =>
        isCampaignAttackPlans(step)
            ? (step.plans ?? []).map((use) => use.cardId)
            : isCampaignDefend(step)
              ? (step.metadata?.plansUsed ?? (step.plans ?? []).map((use) => use.cardId))
              : []
    )
    const attackerPlans = unique([
        ...(declaration.plans ?? []).map((use) => use.cardId),
        ...steps.flatMap((step) =>
            isCampaignAttackPlans(step) ? (step.plans ?? []).map((use) => use.cardId) : []
        )
    ])
    const banditPlans = defenderId
        ? []
        : steps
              .flatMap((step) => battleOf(step)?.plansUsed ?? [])
              .filter((plan) => !attackerPlans.includes(plan))
    const defenderPlans = unique([
        ...defends.flatMap(
            (step) => step.metadata?.plansUsed ?? (step.plans ?? []).map((use) => use.cardId)
        ),
        ...banditPlans
    ])

    const notes = steps.flatMap((step) =>
        recordedNotes(step).flatMap((note) => cardNote(note) ?? [])
    )
    const pools = steps.flatMap((step) => poolsOf(step) ?? [])
    const musterBattle = steps.map(battleOf).find((battle) => battle !== undefined)
    const [muster] = pools
    const last = pools.at(-1)
    assertExists(muster, 'a Campaign musters its dice before it closes')
    assertExists(last, 'a Campaign musters its dice before it closes')
    const roll = closing.roll
    const later = laterPlans.map(planName)

    // Hospital, R-10.13 — set aside, then placed on its site: not lost.
    const placed = campaignSteps.flatMap(recordedHospitalPlaced)
    const saves = new HospitalSaves(state, attackerId, defenderId, placed)
    const savedBy = (seats: readonly string[]) =>
        hospitalPlacedWords(placed.filter((entry) => seats.includes(entry.playerId)))

    const attacking = BattlePlanSide.Attacker
    const skullLoss = saves.count(
        attacking,
        steps.reduce((sum, step) => sum + skullsKilledIn(step), 0)
    )
    const attackerPlanLoss = planLosses(notes, attackerSeats, attackerPlans, saves, attacking)
    const sacrificed = saves.count(attacking, closing.sacrificed)
    const defenderPlanLoss = planLosses(
        notes,
        defenderSeats,
        defenderPlans,
        saves,
        BattlePlanSide.Defender
    )
    const defenseLoss = won ? defeatLosses(steps, names, saves) : []
    const attackLoss = won
        ? []
        : savedLosses(saves, attacking, sacrifice?.defeatKills ?? [], closing.defeatKilled ?? 0, names)

    const attacker: CampaignLedgerSide = {
        seatId: attackerId,
        role: 'attacked',
        dice: poolText(
            muster.attack,
            (musterBattle?.siteDice ?? []).map(
                (site) => `${names.site(site.siteId)} ${signed(site.attack)}`
            ),
            roll?.attackFaces.length ?? last.attack,
            later
        ),
        attackFaces: roll?.attackFaces,
        plan: planLine(attackerPlans, notes, attackerSeats, names),
        lost: lostLine([
            warbandLoss([
                { count: skullLoss, reason: 'to skulls' },
                ...attackerPlanLoss,
                { count: sacrificed, reason: 'sacrificed' },
                ...attackLoss
            ]),
            ...savedBy(attackerSeats)
        ]),
        gained: listedOrNone([
            ...(won && spoils
                ? [
                      ...declaration.targets.flatMap((target) =>
                          target.kind === CampaignTargetKind.Site
                              ? [placedAt(target.siteId, spoils.placements, attackerId, names)]
                              : []
                      ),
                      ...(spoils.metadata?.relicsTaken ?? []).map(cardName),
                      ...(spoils.metadata?.bannersSeized ?? []).map(
                          (banner) => `the ${bannerName(banner)}`
                      )
                  ]
                : []),
            ...planGains(notes, attackerSeats, names)
        ])
    }

    const defender: CampaignLedgerSide = {
        seatId: defenderId,
        role: 'defended',
        dice: poolText(
            muster.defense,
            targetDice(declaration.targets, muster.defense, names),
            roll?.defenseFaces.length ?? last.defense,
            later
        ),
        defenseFaces: roll?.defenseFaces,
        makeup: roll ? defenseMakeup(roll) : undefined,
        plan: planLine(defenderPlans, notes, defenderSeats, names),
        // R-5.5.6 — the bandits are never killed, and lose nothing to a ledger.
        lost: defenderId
            ? defenderLost(
                  warbandLoss([...defenderPlanLoss, ...defenseLoss]),
                  savedBy(defenderSeats),
                  won ? spoils : undefined,
                  declaration.targets,
                  names
              )
            : undefined,
        gained: defenderId ? listedOrNone(planGains(notes, defenderSeats, names)) : undefined
    }

    const against = defenderId ?? 'the bandits'
    const sites = declaration.targets.flatMap((target) =>
        target.kind === CampaignTargetKind.Site ? [names.site(target.siteId)] : []
    )
    const at = sites.length > 0 ? ` at ${listed(sites)}` : ''
    return {
        result: `${attackerId} against ${against}${at}: ${closing.attack} attack to ${closing.defense} defense.`,
        sides: [attacker, defender]
    }
}

/** R-10.13 — a ledger line's warbands: the owner its words name, else the side's own. */
export function sideWarbandOwner(
    whose: WarbandWhose,
    seatId: string | undefined,
    reader: WarbandReader,
    ownWarbandsOf: (playerId: string) => WarbandOwner
): WarbandOwner | undefined {
    return (
        namedWarbandOwner(whose, seatId, reader, ownWarbandsOf) ??
        (seatId === undefined ? undefined : ownWarbandsOf(seatId))
    )
}

function unique(ids: readonly string[]): string[] {
    return [...new Set(ids)]
}

function listedOrNone(items: readonly string[]): string | undefined {
    return items.length > 0 ? items.join(', ') : undefined
}

function signed(count: number): string {
    return count < 0 ? `−${-count}` : `+${count}`
}

function countOf(word: string): number {
    return /^(a|an|one)$/.test(word) ? 1 : Number(word)
}

function battleOf(step: GameAction) {
    return isCampaign(step) || isCampaignAttackPlans(step) || isAnswerConsent(step)
        ? step.metadata?.battle
        : undefined
}

/** R-5.5.2, R-5.5.3 — the dice a step records: as mustered, then as the plans left them. */
function poolsOf(step: GameAction): Pools | undefined {
    const battle = battleOf(step)
    if (battle) return { attack: battle.heldAttackDice ?? battle.attackPool, defense: battle.defensePool }
    if (isCampaignDefend(step) && step.metadata) {
        const meta = step.metadata
        return { attack: meta.heldAttackDice ?? meta.attackPool, defense: meta.defensePool }
    }
    return undefined
}

/** R-5.5.5 — the attacker's warbands a step's skulls killed. */
export function skullsKilledIn(step: GameAction): number {
    const battle = battleOf(step)
    if (battle) return battle.skullsKilled
    if (isCampaignDefend(step)) return step.metadata?.skullsKilled ?? 0
    if (isAnswerQuestion(step)) return step.metadata?.heldAttack?.skullsKilled ?? 0
    if (isCampaignSkullLosses(step)) return forceTotal(step.metadata?.killed ?? step.kills)
    return 0
}

/**
 * R-5.5.2, R-5.5.3 — a side's dice as mustered, with where they came from, then as rolled when the
 * plans used after the muster changed them: "10 (Plains +1); 9 rolled (Bear Traps −1)".
 */
function poolText(
    mustered: number,
    from: readonly string[],
    rolled: number,
    laterPlans: readonly string[]
): string {
    const base = from.length > 0 ? `${mustered} (${from.join(', ')})` : `${mustered}`
    if (rolled === mustered) return base
    const by = laterPlans.length > 0 ? `${listed(laterPlans)} ` : ''
    return `${base}; ${rolled} rolled (${by}${signed(rolled - mustered)})`
}

/**
 * R-5.5.2 — each target's printed defense dice ("Plains 1, Cup of Plenty 2, pawn 2") when the
 * record accounts for every mustered die; else the targets alone, since a banner's dice and a
 * title's or a card's extra die are not recorded.
 */
function targetDice(
    targets: readonly CampaignTarget[],
    mustered: number,
    names: HistoryNames
): string[] {
    const dice = targets.map((target) => targetDie(target, names))
    const counted = dice.reduce((sum, die) => sum + (die.dice ?? 0), 0)
    const whole = dice.every((die) => die.dice !== undefined) && counted === mustered
    return dice.map((die) => (whole ? `${die.label} ${die.dice}` : die.label))
}

function targetDie(target: CampaignTarget, names: HistoryNames): { label: string; dice?: number } {
    switch (target.kind) {
        case CampaignTargetKind.Site:
            return { label: names.site(target.siteId), dice: 1 }
        case CampaignTargetKind.Relic:
            return { label: cardName(target.cardId), dice: relicDefenseDice(target.cardId) }
        case CampaignTargetKind.Banner:
            return { label: `the ${bannerName(target.banner)}` }
        case CampaignTargetKind.PawnAndFavor:
            return { label: 'pawn', dice: 2 }
        case CampaignTargetKind.SiteRelic:
            return { label: 'a relic', dice: 1 }
    }
}

/** R-5.5.4.a — doublings stack, so the shields before them are the counted shields halved once each. */
function defenseMakeup(roll: CampaignRollRecord): DefenseMakeup {
    const doublings = roll.defenseFaces.filter((face) => face.doubling).length
    return {
        shields: roll.shields / 2 ** doublings,
        doublings,
        doubled: roll.shields,
        warbands: forceTotal(roll.defendingForce),
        bandits: roll.defendingBandits,
        defense: roll.defense
    }
}

/** R-5.5.4 — the makeup after its shields: " doubled to 6, + 3 warbands: 9 defense". */
export function makeupWords(makeup: DefenseMakeup): string {
    const doubled =
        makeup.doublings === 0
            ? ''
            : ` doubled${makeup.doublings > 1 ? ` ${makeup.doublings} times` : ''} to ${makeup.doubled}`
    const warbands = makeup.warbands > 0 ? `, + ${plural(makeup.warbands, 'warband')}` : ''
    const bandits = makeup.bandits > 0 ? `, + ${plural(makeup.bandits, 'bandit')}` : ''
    return `${doubled}${warbands}${bandits}: ${makeup.defense} defense`
}

/** A side's plans, each with what its notes say it did: "Field Promotion: gained 3 warbands". */
function planLine(
    plans: readonly string[],
    notes: readonly PlanNote[],
    seats: readonly string[],
    names: HistoryNames
): string | undefined {
    const items = plans.map((plan) => {
        const name = planName(plan)
        const said = notes
            .filter((note) => note.card === name)
            .map((note) => sideWords(note.text, seats, names))
        return said.length > 0 ? `${name}: ${said.join('; ')}` : name
    })
    return items.length > 0 ? items.join('; ') : undefined
}

/** A note under a side's chip: a subject that is the side's own seat goes, the rest as History says it. */
function sideWords(text: string, seats: readonly string[], names: HistoryNames): string {
    const subject = seats.find((seat) => text.startsWith(`${seat} `))
    const rest = subject ? text.slice(subject.length + 1) : text
    return historyText(namedNote(rest, subject ?? seats[0], names, undefined), names)
}

/**
 * R-5.5.3 — a side's warbands its own plans sacrificed, less those Hospital saved, or a plan killed
 * on its seats' boards (a kill Hospital held says so in its note, and is no loss).
 */
function planLosses(
    notes: readonly PlanNote[],
    seats: readonly string[],
    plans: readonly string[],
    saves: HospitalSaves,
    side: BattlePlanSide
): Loss[] {
    const own = new Set(plans.map(planName))
    return notes.flatMap((note) => {
        const killed = KILLED_ON_BOARD.exec(note.text)
        if (killed && seats.includes(killed[2])) {
            return [{ count: countOf(killed[1]), reason: `to ${note.card}` }]
        }
        const sacrificed = SACRIFICED.exec(note.text)
        if (sacrificed && own.has(note.card)) {
            return [{ count: saves.count(side, countOf(sacrificed[1])), reason: `to ${note.card}` }]
        }
        return []
    })
}

/** R-5.5.8 — what a side's seats gained by a plan: "3 warbands", "2 favor from the order bank". */
function planGains(
    notes: readonly PlanNote[],
    seats: readonly string[],
    names: HistoryNames
): string[] {
    return notes.flatMap((note) => {
        const gained = GAINED.exec(note.text)
        if (!gained || !seats.includes(gained[1])) return []
        return [historyText(namedNote(gained[2], gained[1], names, undefined), names)]
    })
}

/**
 * R-5.5.6 — the defending force's losses: where they were picked; else, with no pick asked
 * (R-5.5.6.a), the engine's default, taken from the force as rolled in its order (revision 25 records
 * it); else how many were killed. Each less those Hospital saved.
 */
function defeatLosses(
    steps: readonly GameAction[],
    names: HistoryNames,
    saves: HospitalSaves
): Loss[] {
    const side = BattlePlanSide.Defender
    const picked = steps.find(isCampaignDefeatKills)
    if (picked) {
        return savedLosses(saves, side, picked.kills, picked.metadata?.defeatKilled ?? 0, names)
    }
    const closing = steps.find(isCampaignSacrifice)?.metadata
    const killed = closing?.defeatKilled ?? 0
    const force = closing?.roll?.defendingForce
    return savedLosses(saves, side, force ? takeFromGroups(force, killed) : [], killed, names)
}

/** R-5.5.6 — losses at the places the record names, less those Hospital saved; else the count. */
function savedLosses(
    saves: HospitalSaves,
    side: BattlePlanSide,
    groups: readonly WarbandGroup[],
    killed: number,
    names: HistoryNames
): Loss[] {
    if (groups.length === 0 || forceTotal(groups) !== killed) {
        return [{ count: saves.count(side, killed), reason: 'killed' }]
    }
    const kept = saves.groups(side, groups)
    return placedLosses(kept, forceTotal(kept), names)
}

/** Losses at the places the record names when they account for every one killed ("killed at Plains"); else the count. */
function placedLosses(groups: readonly WarbandGroup[], killed: number, names: HistoryNames): Loss[] {
    const placed = warbandPlaces(groups, undefined, names)
    if (placed.length === 0 || forceTotal(groups) !== killed) return [{ count: killed, reason: 'killed' }]
    return placed.map((group) => ({ count: group.count, reason: `killed ${group.place}` }))
}

/** A Lost line's parts: the warbands killed, then where Hospital placed those it saved. */
function lostLine(parts: readonly (string | undefined)[]): string | undefined {
    const said = parts.filter((part) => part !== undefined)
    return said.length > 0 ? said.join('; ') : undefined
}

/** "4 warbands: 2 to skulls, 1 to Bear Traps, 1 sacrificed"; one reason alone, "1 warband killed at Plains". */
function warbandLoss(losses: readonly Loss[]): string | undefined {
    const lost = losses.filter((loss) => loss.count > 0)
    const [only, ...more] = lost
    if (!only) return undefined
    if (more.length === 0) return `${plural(only.count, 'warband')} ${only.reason}`
    const total = lost.reduce((sum, loss) => sum + loss.count, 0)
    return `${plural(total, 'warband')}: ${lost.map((loss) => `${loss.count} ${loss.reason}`).join(', ')}`
}

/** R-5.5.7 — a site won, with the warbands placed there: "Plains (2 warbands placed)". */
function placedAt(
    siteId: string,
    placements: readonly CampaignPlacement[],
    attackerId: string,
    names: HistoryNames
): string {
    const placed = placements
        .filter((placement) => placement.siteId === siteId && placement.count > 0)
        .map((placement) => warbandsOf(placement.count, placement.owner, names.player, attackerId))
    const site = names.site(siteId)
    return placed.length > 0 ? `${site} (${placed.join(' and ')} placed)` : site
}

/**
 * R-5.5.6, R-5.5.7 — what the defender lost: their warbands, then the targets a victory took (the
 * sites, relics and banners), the favor burned; where Hospital placed the warbands it saved; and
 * where they were banished.
 */
function defenderLost(
    warbands: string | undefined,
    saved: readonly string[],
    spoils: CampaignResolveVictory | undefined,
    targets: readonly CampaignTarget[],
    names: HistoryNames
): string | undefined {
    const taken = spoils?.metadata
    const favor = taken?.favorBurned ?? 0
    const items = [
        ...(warbands ? [warbands] : []),
        ...(taken
            ? [
                  ...targets.flatMap((target) =>
                      target.kind === CampaignTargetKind.Site ? [names.site(target.siteId)] : []
                  ),
                  ...(taken.relicsTaken ?? []).map(cardName),
                  ...(taken.bannersSeized ?? []).map((banner) => `the ${bannerName(banner)}`),
                  ...(favor > 0 ? [`${favor} favor`] : [])
              ]
            : [])
    ]
    const banished = taken?.banishedToSiteId
    const parts = [
        ...(items.length > 0 ? [items.join(', ')] : []),
        ...saved,
        ...(banished ? [`banished to ${names.site(banished)}`] : [])
    ]
    return parts.length > 0 ? parts.join('; ') : undefined
}

/**
 * Hospital, R-10.28-H2 — takes from a side's losses the warbands a Hospital set aside and then placed
 * on its site: those of the places its user holds, up to what it placed. A loss whose record names
 * no place is the side's own seat's, as every place of a force is from revision 13.
 */
class HospitalSaves {
    private readonly left = new Map<string, number>()
    private readonly kills: CampaignKillPath

    constructor(
        private readonly state: HydratedOathGameState | undefined,
        private readonly attackerId: string,
        private readonly defenderId: string | undefined,
        placed: readonly HeldForHospital[]
    ) {
        const sites = new Map<string, string>()
        for (const entry of placed) {
            this.left.set(entry.playerId, (this.left.get(entry.playerId) ?? 0) + entry.count)
            sites.set(entry.playerId, entry.siteId)
        }
        this.kills = {
            attackerPlayerId: attackerId,
            defenderPlayerId: defenderId,
            killRedirects: [...sites].map(([playerId, siteId]) => ({ playerId, siteId }))
        }
    }

    /** The groups as they were picked, less the warbands saved. */
    groups(side: BattlePlanSide, groups: readonly WarbandGroup[]): WarbandGroup[] {
        return groups.flatMap((group) => {
            const kept = group.count - this.take(side, group, group.count)
            return kept > 0 ? [{ ...group, count: kept }] : []
        })
    }

    /** `count` of the side's warbands, where the record does not say, less those saved. */
    count(side: BattlePlanSide, count: number): number {
        const seatId = side === BattlePlanSide.Attacker ? this.attackerId : this.defenderId
        if (seatId === undefined) return count
        const board: LossSource = { at: { kind: 'board', playerId: seatId }, owner: seatId }
        return count - this.take(side, board, count)
    }

    private take(side: BattlePlanSide, source: LossSource, count: number): number {
        if (this.left.size === 0 || count <= 0) return 0
        assertExists(this.state, 'Whose Hospital held a loss is read from the game')
        const holder = hospitalHolderOf(this.state, this.kills, side, source)
        if (holder === undefined) return 0
        const left = this.left.get(holder) ?? 0
        const taken = Math.min(left, count)
        this.left.set(holder, left - taken)
        return taken
    }
}
