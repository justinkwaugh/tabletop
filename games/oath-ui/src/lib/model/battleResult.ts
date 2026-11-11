import { assertExists, type GameAction } from '@tabletop/common'
import {
    BattlePlanSide,
    decidingPlans,
    forceTotal,
    hospitalHolderOf,
    isCampaign,
    isCampaignDefeatKills,
    ownWarbandOwner,
    sameLossSource,
    survivorBoardOf,
    takeFromGroups,
    type CampaignState,
    type HydratedOathGameState,
    type WarbandGroup,
    type WarbandOwner
} from '@tabletop/oath'
import { skullsKilledIn } from '$lib/model/campaignLedger.js'
import { cardName } from '$lib/model/names.js'

/**
 * A run of a battle's result line: words; consequence words, in rose; Hospital's name, in bold; a
 * seat's chip; a die face (the sword, the shield, the skull); a warband in its owner's colour; a card.
 */
export type ResultPart =
    | { kind: 'text'; text: string }
    | { kind: 'rose'; text: string }
    | { kind: 'strong'; text: string }
    | { kind: 'seat'; playerId: string }
    | { kind: 'sword' }
    | { kind: 'shield' }
    | { kind: 'skull' }
    | { kind: 'warband'; owner: WarbandOwner }
    | { kind: 'card'; cardId: string }

const text = (words: string): ResultPart => ({ kind: 'text', text: words })
const HOSPITAL: ResultPart = { kind: 'strong', text: 'Hospital' }

/** The steps of the Campaign under way: from its declaration on. */
export function currentCampaignSteps(actions: readonly GameAction[]): GameAction[] {
    const declared = actions.findLastIndex(isCampaign)
    return declared < 0 ? [] : actions.slice(declared)
}

/** The line's words alone, for a test or a screen reader. */
export function resultWords(parts: readonly ResultPart[]): string {
    return parts
        .map((part) => {
            switch (part.kind) {
                case 'text':
                case 'rose':
                case 'strong':
                    return part.text
                case 'seat':
                    return `[${part.playerId}]`
                case 'card':
                    return `[${cardName(part.cardId)}]`
                default:
                    return `[${part.kind}]`
            }
        })
        .join('')
}

/**
 * R-5.5.5 — the battle as the attacker sees it before the sacrifice: a battle a plan decided names
 * the card and the victor; otherwise what the skulls killed, then the swords against the defense,
 * and the win or, counted in swords (R-5.5.5.b: a tie is the defender's), how far short.
 */
export function battleLine(
    state: HydratedOathGameState,
    campaign: CampaignState,
    steps: readonly GameAction[]
): ResultPart[] {
    if (campaign.decidedVictor) return decidedLine(state, campaign)
    const short = campaign.defense + 1 - campaign.swords
    return [
        ...skullClause(state, campaign, steps),
        text(`${campaign.swords} `),
        { kind: 'sword' },
        text(` against ${campaign.defense} `),
        { kind: 'shield' },
        text(': '),
        ...(short > 0
            ? [text('you are '), { kind: 'rose', text: `${short} short` } as const]
            : [text('you win')]),
        text('.')
    ]
}

/** Hearts and Minds, Peace Envoy — "you're victorious now": the card, then who. */
function decidedLine(state: HydratedOathGameState, campaign: CampaignState): ResultPart[] {
    const victorId =
        campaign.decidedVictor === 'attacker'
            ? campaign.attackerPlayerId
            : campaign.defenderPlayerId
    // Only a player's own plan decides a battle: the bandits' compelled plans never do.
    assertExists(victorId, 'A battle a plan decided has a player as its victor')
    const card = decidingPlans(state, campaign).victory
    return [
        ...(card
            ? [
                  { kind: 'card', cardId: card } as const,
                  text(`${cardName(card)} decided the battle: `)
              ]
            : []),
        { kind: 'seat', playerId: victorId },
        text(' is victorious.')
    ]
}

/**
 * R-5.5.5 — "1 [skull] rolled: 1 [warband] died.", the skulls as rolled and the warbands they took,
 * from the Campaign's record; none when they took none (Outriders ignores them). Hospital sets aside
 * what the attacker's own Hospital holds (R-10.28-H2: every place of the force is the attacker's).
 */
function skullClause(
    state: HydratedOathGameState,
    campaign: CampaignState,
    steps: readonly GameAction[]
): ResultPart[] {
    const rolled = campaign.attackRoll.reduce((sum, face) => sum + face.skulls, 0)
    const killed = steps.reduce((sum, step) => sum + skullsKilledIn(step), 0)
    if (rolled === 0 || killed === 0) return []
    const attackerId = campaign.attackerPlayerId
    const held =
        hospitalHolderOf(state, campaign, BattlePlanSide.Attacker, {
            at: { kind: 'board', playerId: attackerId },
            owner: attackerId
        }) !== undefined
    return [
        text(`${rolled} `),
        { kind: 'skull' },
        text(` rolled: ${killed} `),
        { kind: 'warband', owner: ownWarbandOwner(state, attackerId) },
        ...(held
            ? [text(` ${killed === 1 ? 'is' : 'are'} set aside at `), HOSPITAL]
            : [text(' '), { kind: 'rose', text: 'died' } as const]),
        text('. ')
    ]
}

/**
 * R-5.5.6 — where the defeated defence went, once the attacker has won: those killed died, those
 * its Hospital holds are set aside there, and the rest went home to their boards, or to the plan
 * that takes them (the Obsidian Cage); the bandits went into hiding (R-2.8.3). The pick is the
 * defending side's own when they chose (R-5.5.6.a), else the engine's, as the record keeps them.
 * None when nothing defended.
 */
export function spoilsLine(
    state: HydratedOathGameState,
    campaign: CampaignState,
    steps: readonly GameAction[],
    viewerId: string | undefined
): ResultPart[] | undefined {
    const clauses = defenceClauses(state, campaign, steps)
    if (campaign.defendingBandits > 0) {
        const bandits = campaign.defendingBandits
        clauses.push([
            text(bandits === 1 ? 'the bandit' : `the ${bandits} bandits`),
            text(' went into hiding')
        ])
    }
    if (clauses.length === 0) return undefined
    const attackerId = campaign.attackerPlayerId
    const who: ResultPart[] =
        viewerId === attackerId
            ? [text('You won: ')]
            : [{ kind: 'seat', playerId: attackerId }, text(' won: ')]
    return [...who, ...joined(clauses), text('.')]
}

function defenceClauses(
    state: HydratedOathGameState,
    campaign: CampaignState,
    steps: readonly GameAction[]
): ResultPart[][] {
    const force = campaign.defendingForce
    const defenderId = campaign.defenderPlayerId
    const total = forceTotal(force)
    if (total === 0 || defenderId === undefined) return []
    const killed = campaign.defeatKilled ?? 0
    const kills = defeatKills(force, killed, steps)
    const held = forceTotal(
        kills.filter(
            (group) =>
                hospitalHolderOf(state, campaign, BattlePlanSide.Defender, group) !== undefined
        )
    )
    const died = killed - held
    const survivors = total - killed
    const defence = (count?: number): ResultPart[] => [
        ...(count === undefined ? [] : [text(`${count} of `)]),
        { kind: 'seat', playerId: defenderId },
        text("'s defence ")
    ]

    const clauses: ResultPart[][] = []
    if (died > 0) clauses.push([...defence(died), { kind: 'rose', text: 'died' }])
    if (held > 0) {
        const whose = clauses.length === 0 ? defence(held) : [text(`${held} `)]
        clauses.push([...whose, text('are set aside at '), HOSPITAL])
    }
    if (survivors > 0) {
        const others = clauses.length > 0
        const cage = decidingPlans(state, campaign).survivors
        if (cage) {
            const taken: ResultPart[] = others
                ? [text(`the other ${survivors}`)]
                : [{ kind: 'seat', playerId: defenderId }, text("'s defence")]
            clauses.push([
                { kind: 'card', cardId: cage },
                text(`${cardName(cage)} took `),
                ...taken
            ])
        } else {
            const boards = new Set(
                survivingGroups(force, kills).map((group) =>
                    survivorBoardOf(state, group, undefined)
                )
            ).size
            const home = `went home to their ${boards === 1 ? 'board' : 'boards'}`
            clauses.push(
                others ? [text(`the other ${survivors} ${home}`)] : [...defence(), text(home)]
            )
        }
    }
    return clauses
}

/** R-5.5.6.a — the defending side's pick when they made one, else the engine's from the force as rolled. */
function defeatKills(
    force: readonly WarbandGroup[],
    killed: number,
    steps: readonly GameAction[]
): WarbandGroup[] {
    const picked = steps.find(isCampaignDefeatKills)
    return picked ? picked.kills : takeFromGroups(force, killed)
}

/** The force less the warbands killed from it, group by group. */
function survivingGroups(
    force: readonly WarbandGroup[],
    kills: readonly WarbandGroup[]
): WarbandGroup[] {
    const left = force.map((group) => ({ ...group }))
    for (const kill of kills) {
        let count = kill.count
        for (const group of left) {
            if (count === 0) break
            if (!sameLossSource(group, kill)) continue
            const taken = Math.min(group.count, count)
            group.count -= taken
            count -= taken
        }
    }
    return left.filter((group) => group.count > 0)
}

/** "a, and b"; "a, b, and c". */
function joined(clauses: readonly ResultPart[][]): ResultPart[] {
    return clauses.flatMap((clause, index) => [
        ...(index === 0 ? [] : [text(index === clauses.length - 1 ? ', and ' : ', ')]),
        ...clause
    ])
}
