import { HydratedOathGameState } from '../model/gameState.js'
import type { Banner, Region, Suit } from '../model/oathEnums.js'
import type { PersistentContext } from '../util/persistent.js'
import type { BannerTake } from '../util/seize.js'
import type { HiddenRequest, HiddenReveal, PileDeposit } from '../model/hidden.js'
import {
    type BattlePlanSide,
    type CardPower,
    type PowerCost,
    powerKey
} from '../data/cardPowers.js'
import type { CampaignParties, DiceDelta, DicePools } from '../util/campaign.js'
import type { ImperialScope } from '../util/rule.js'
import type { RollRules, WarbandGroup } from '../model/campaign.js'
import type { WarbandOwner } from '../model/warbandCounts.js'
import type { PowerOutcome } from '../model/powerOutcome.js'
import type { DiscardTarget } from '../util/discard.js'
import { assert } from '@tabletop/common'
import type { ChoiceSpec, PowerChoice, PowerChoiceKind } from '../util/powerChoice.js'
export interface ModifierParticulars {
    destinationSiteId?: string
    cardId?: string
    /** `TradeOption`'s value. */
    tradeOption?: string
    /** `SearchSource`'s value. */
    drawFrom?: string
    playedCardId?: string
    /** `SearchPlay`'s value. */
    playedTo?: string
    /** Land Warden — the second card, when it is shown (never a discard). */
    secondPlayedCardId?: string
    /** Greedy — after the cost fold. */
    supplyCost?: number
    /** `Banner`'s value. */
    banner?: string
    /** R-6.1 */
    facedownAdviserPlay?: boolean
}

export interface EffectContext {
    state: HydratedOathGameState
    playerId: string
    power: CardPower
    choices: readonly PowerChoice[]
    /** Absent for a used power. */
    particulars?: ModifierParticulars
    reveal?: HiddenReveal
}

export interface CampaignContext {
    parties: CampaignParties
    side: BattlePlanSide
    pools: DicePools
}

/** R-5.5.3 — `playerId` is undefined for the bandits' compelled plans (R-5.5.3-H1). */
export interface BattlePlanContext extends Omit<EffectContext, 'playerId'> {
    playerId: string | undefined
    campaign: CampaignContext
}

/** A declared plan, or one at the outcome step, which the bandits' plans never reach. */
export interface PlayerPlanContext extends EffectContext {
    campaign: CampaignContext
}

export interface EffectResult extends PowerOutcome {
    summary: string
    /** R-10.13 — whose warbands an Action power's summary counts, when they were one owner's. */
    warbandOwner?: WarbandOwner
    /** R-4.2 */
    endsActPhase?: boolean
    /** Oracle — "as if you searched". */
    opensSearch?: boolean
}

/** R-9.4 */
export interface OutcomeResult {
    note: string
    pileDeposits?: PileDeposit[]
}

/** Hooks taking a `base` fold in declaration order; the result floors at zero. */
export interface ModifierHooks {
    /** R-7.4.1 — a failing declared optional modifier is refused; a mandatory one is simply not applied. */
    condition?: (ctx: EffectContext) => string | undefined
    /** R-5.1.1 to R-5.6.1 */
    supplyCost?: (base: number, ctx: EffectContext) => number
    /** R-7.6.2 — beats every `supplyCost`, whichever is declared first. */
    spendsNoSupply?: (ctx: EffectContext) => boolean
    /** R-5.2.2 — before the personal-bank cap. */
    musterWarbands?: (base: number, ctx: EffectContext) => number
    /** R-5.3.2 — before the bank cap. */
    tradeFavor?: (base: number, ctx: EffectContext) => number
    /** R-5.3.2 */
    tradeSecrets?: (base: number, ctx: EffectContext) => number
    /** Magician's Code — beyond those paid. */
    recoverSecrets?: (base: number, ctx: EffectContext) => number
    /** R-5.1.2 — the Vision stop still applies. */
    drawCount?: (base: number, ctx: EffectContext) => number
    /** Mushrooms — replaces the count before any `drawCount` adds to it. */
    setsDrawCount?: number
    /** Truthful Harp — the kept card too. */
    revealsDraw?: boolean
    /** R-7.1.2.a */
    relaxOccupancy?: (ctx: EffectContext) => boolean
    /** R-6.6.2.a — a mandatory modifier's "you cannot …". */
    forbids?: (ctx: EffectContext) => string | undefined
    /** Initiation Rite — "to muster, you must place a secret instead of favor". */
    musterPlacesSecret?: boolean
    /** Errand Boy, Observatory */
    drawRegion?: (ctx: EffectContext) => Region | undefined
    /** Master of Disguise */
    matchingAdvisersOf?: (ctx: EffectContext) => string | undefined
    /** Acting Troupe */
    adviserSuitOverride?: (ctx: EffectContext) => { cardId: string; suit: Suit } | undefined
    /** Mushrooms */
    drawsFromBottom?: boolean
    /** Bracken */
    discardTo?: (ctx: EffectContext) => DiscardTarget | undefined
    /** Map Library, Small Friends — beyond the pawn's site. */
    tradeSites?: (ctx: EffectContext) => string[]
    /** Small Friends — "act as if your pawn is at" these sites. */
    actsAsAtSites?: (ctx: EffectContext) => string[]
    /** Crop Rotation — a denizen at the site played to may be discarded first, named with the play. */
    discardFirstAtSitePlay?: boolean
    /** Book of Records — instead of R-5.1.4.I's favor. */
    sitePlayGainsSecret?: boolean
    /** New Growth */
    playAnywhere?: (ctx: EffectContext) => boolean
    /** Land Warden — if at least one play is to a site. */
    secondPlay?: boolean
    /** Part of the price: runs after costs, before the action. */
    before?: (ctx: EffectContext) => string | undefined
    /** R-4.2 — runs once the action has finished. */
    after?: (ctx: EffectContext) => { summary?: string; endsActPhase?: boolean } | undefined
    /** Portal */
    ignoresSitePowers?: boolean
}

/** R-7.5, R-5.5.3 */
export interface BattlePlanHooks {
    /** Asked of declared plans only; the bandits' compelled plans never are. */
    reasonCannotUse?: (ctx: PlayerPlanContext) => string | undefined
    /** R-7.5.4 — underflow per R-5.5.3. */
    dice?: (ctx: BattlePlanContext) => DiceDelta | undefined
    /** Scouts */
    onUse?: (ctx: BattlePlanContext) => string | undefined
    /** Outriders, R-5.5.5 */
    ignoreSkulls?: boolean
    /** R-5.5.8 */
    discardAtEnd?: boolean | ((ctx: BattlePlanContext) => boolean)
    /** R-5.5.4, R-5.5.5 */
    rollRules?: RollRules | ((ctx: BattlePlanContext) => RollRules | undefined)
    /** R-5.5.6 — `none` beats `all`. */
    defeatKills?: 'none' | 'all'
    /** Runs once the sacrifice decides the battle. */
    onOutcome?: (ctx: PlayerPlanContext, victorious: boolean) => string | OutcomeResult | undefined
    /** Specialist */
    locksEnemyPlans?: boolean
    /** Code of Honor, R-10.28-H1 — binds the user's whole side. */
    exclusive?: boolean
    /** Hearts and Minds, Peace Envoy — nothing is rolled. */
    decidesVictor?: boolean
    /** Peace Envoy — no skulls, and R-5.5.6 kills nothing. */
    ignoreKills?: boolean
    /** Hospital — while the user rules it. */
    redirectKillsTo?: (ctx: BattlePlanContext) => string | undefined
    /** Sticky Fire — R-5.5.6's half becomes all. */
    killsEnemyForce?: boolean
    /** Relic Hunter */
    targetsSiteRelics?: boolean
    /** Wild Mounts, R-5.5.8 — one of `insteadCardIds` is discarded instead. */
    sparesEndDiscards?: (
        ctx: PlayerPlanContext,
        owedCardIds: readonly string[]
    ) => { planCardIds: string[]; insteadCardIds: string[] } | undefined
    /** Obsidian Cage — R-5.5.6 then moves none home. */
    takesEnemySurvivors?: (ctx: PlayerPlanContext, survivors: readonly WarbandGroup[]) => string
}

/** R-7.1.4-H1 */
export interface ContinuousHooks {
    /** R-7.6.4 */
    adviserLimit?: number
    /** Vow of Poverty, R-9.2 */
    cannotGainFavorFromTrade?: boolean
    /** Vow of Obedience, R-9.2 */
    cannotPlayVisionsFaceup?: boolean
    /** Ring of Devotion, R-9.2 — at R-6.5's move and R-5.5.7.I's placement. */
    cannotPlaceWarbandsAtSites?: boolean
    /** Ring of Devotion */
    musterWarbandsBonus?: number
    /** Pied Piper — on the card itself. */
    ignoresAdviserLimit?: boolean
    /** Family Wagon */
    adviserLimitExemptSuit?: Suit
    /** Vow of Kinship — the holder's favor is used from this bank. */
    keepsFavorInBank?: Suit
}

/** R-7.1.4 */
export interface PersistentHooks {
    forbidsTrade?: (ctx: PersistentContext, actorId: string, cardId: string) => string | undefined
    forbidsMuster?: (ctx: PersistentContext, actorId: string, cardId: string) => string | undefined
    forbidsFacedownAdviser?: (ctx: PersistentContext, actorId: string) => string | undefined
    forbidsFaceupVision?: (
        ctx: PersistentContext,
        actorId: string,
        cardId: string
    ) => string | undefined
    /** A Recover, a Campaign target or the Conspiracy's take; `holderId` is absent when nobody holds it. */
    forbidsBannerTake?: (
        ctx: PersistentContext,
        actorId: string,
        banner: Banner,
        how: BannerTake,
        holderId?: string
    ) => string | undefined
    /** Any target or take of another player's relic: a Campaign, Blackmail, Relic Thief, the Conspiracy. */
    forbidsRelicTake?: (
        ctx: PersistentContext,
        actorId: string,
        holderId: string,
        relicCardId: string
    ) => string | undefined
    /** Spell Breaker */
    forbidsSecretCosts?: (ctx: PersistentContext, actorId: string) => string | undefined
    /** Vow of Silence */
    forbidsGivingSecrets?: (ctx: PersistentContext, actorId: string) => string | undefined
    forbidsCampaign?: (ctx: PersistentContext, actorId: string) => string | undefined
    forbidsSacrifice?: (
        ctx: PersistentContext,
        attackerId: string,
        defenderId: string | undefined
    ) => string | undefined
    forbidsExile?: (ctx: PersistentContext, citizenId: string) => string | undefined
    forbidsBattlePlan?: (
        ctx: PersistentContext,
        userId: string,
        power: CardPower,
        parties: CampaignParties,
        side: BattlePlanSide
    ) => string | undefined
    /** Giant Python */
    forbidsTargets?: (
        ctx: PersistentContext,
        parties: CampaignParties,
        defensePool: number
    ) => string | undefined
    /** Gleaming Armor, Insect Swarm */
    battlePlanExtraCost?: (
        ctx: PersistentContext,
        userId: string,
        parties: CampaignParties,
        side: BattlePlanSide
    ) => Partial<PowerCost> | undefined
    /** Sealing Ward — beyond the relic's printed dice. */
    relicDefenseBonus?: (ctx: PersistentContext, holderId: string) => number | undefined
    /** Marriage */
    extraMatchingAdvisers?: (
        ctx: PersistentContext,
        holderId: string,
        suit: Suit
    ) => number | undefined
    afterTravel?: (
        ctx: PersistentContext,
        actorId: string,
        fromSiteId: string | undefined,
        toSiteId: string
    ) => string | undefined
    afterTitleTaken?: (ctx: PersistentContext, newHolderId: string) => string | undefined
    afterCardPlayed?: (
        ctx: PersistentContext,
        actorId: string,
        cardId: string
    ) => string | undefined
    afterBannerRecovered?: (
        ctx: PersistentContext,
        actorId: string,
        banner: Banner,
        placed: number
    ) => string | undefined
    /** Jinx */
    offersReroll?: (ctx: PersistentContext, rollerId: string) => boolean
    /** Ancient Bloodline */
    locksSiteFor?: (ctx: PersistentContext, actorId: string, siteId: string) => boolean
    /** Circlet of Command — beyond R-5.5.2's two. */
    pawnDefenseBonus?: (ctx: PersistentContext, holderId: string) => number | undefined
    /** Vow of Renewal */
    takesBurnedFavor?: (ctx: PersistentContext) => string | undefined
    /** Vow of Union */
    forbidsTravel?: (
        ctx: PersistentContext,
        actorId: string,
        fromSiteId: string | undefined,
        toSiteId: string
    ) => string | undefined
    /** Vow of Union */
    extraForceSites?: (ctx: PersistentContext, attackerId: string) => string[] | undefined
    /** Relic Thief */
    afterRelicsTaken?: (
        ctx: PersistentContext,
        takerId: string,
        relicCardIds: readonly string[]
    ) => string | undefined
    /** Herald — fires as the Campaign ends. */
    afterCampaign?: (
        ctx: PersistentContext,
        attackerId: string,
        defenderId: string | undefined
    ) => string | undefined
    /** Toll Roads */
    tollToTravel?: (ctx: PersistentContext, actorId: string, toSiteId: string) => boolean
    /** Curfew */
    tollToTrade?: (ctx: PersistentContext, actorId: string, cardId: string) => boolean
    /** Forced Labor */
    tollToSearch?: (ctx: PersistentContext, actorId: string) => boolean
    /** Way Station */
    travelFreeForToll?: (ctx: PersistentContext, actorId: string, toSiteId: string) => boolean
    /** Bandit Crown, R-7.6.5 */
    banditsAreHolderWarbands?: boolean
    /** Grand Mask — undefined leaves R-10.21 to decide. */
    cardRuleAt?: (
        ctx: PersistentContext,
        playerId: string,
        cardId: string,
        siteId: string,
        scope?: ImperialScope
    ) => boolean | undefined
}

export interface EffectDefinition {
    choices: ChoiceSpec[]
    /** The vault's answer reaches `resolve` as `ctx.reveal`. */
    hidden?: (ctx: EffectContext) => HiddenRequest | undefined
    reasonCannotResolve?: (ctx: EffectContext) => string | undefined
    resolve: (ctx: EffectContext) => EffectResult
    /** A copy of the state as `ctx.choices` leave it, which `sequential` choices are read on. */
    stateAfter?: (ctx: EffectContext) => HydratedOathGameState
    /** R-7.4 — never read by the doorway. */
    modifier?: ModifierHooks
    /** R-7.4.1's "must": applied unasked, never declared. */
    mandatory?: boolean
    /** R-7.5 */
    battlePlan?: BattlePlanHooks
    /** R-7.1.4-H1 */
    continuous?: ContinuousHooks
    /** R-7.1.4 */
    persistent?: PersistentHooks
}

const declarations = new Map<string, ChoiceSpec[]>()

/** Redeclaring an address replaces it, so a hot reload cannot stack declarations. */
export function declareChoices(cardId: string, index: number, specs: ChoiceSpec[]): void {
    declarations.set(powerKey(cardId, index), specs)
}

/** The card powers register themselves on load, so a read before `powers/index.js` sees none. */
export const POWERS_NOT_LOADED =
    'No Oath card powers are registered: import the Oath runtime or `powers/index.js` before reading a power'

export function choiceSpecsFor(power: CardPower): ChoiceSpec[] {
    assert(declarations.size > 0, POWERS_NOT_LOADED)
    return declarations.get(powerKey(power.cardId, power.powerIndex)) ?? []
}

const effects = new Map<string, EffectDefinition>()

export function registerEffect(cardId: string, index: number, definition: EffectDefinition): void {
    effects.set(powerKey(cardId, index), definition)
    declareChoices(cardId, index, definition.choices)
}

export function registerModifier(
    cardId: string,
    index: number,
    definition: {
        hooks: ModifierHooks
        choices?: ChoiceSpec[]
        reasonCannotResolve?: (ctx: EffectContext) => string | undefined
        mandatory?: boolean
    }
): void {
    registerEffect(cardId, index, {
        choices: definition.choices ?? [],
        reasonCannotResolve: definition.reasonCannotResolve,
        resolve: () => {
            throw Error(
                `${cardId} is a modifier: declare it on the major action it names (R-7.4), it cannot be used on its own`
            )
        },
        modifier: definition.hooks,
        mandatory: definition.mandatory
    })
}

export function registerBattlePlan(
    cardId: string,
    index: number,
    definition: {
        hooks: BattlePlanHooks
        choices?: ChoiceSpec[]
    }
): void {
    registerEffect(cardId, index, {
        choices: definition.choices ?? [],
        resolve: () => {
            throw Error(
                `${cardId} is a battle plan: it is used in a Campaign's battle-plan step (R-5.5.3), not on its own`
            )
        },
        battlePlan: definition.hooks
    })
}

export function registerContinuous(cardId: string, index: number, hooks: ContinuousHooks): void {
    registerEffect(cardId, index, {
        choices: [],
        resolve: () => {
            throw Error(
                `${cardId}'s power ${index} is always in effect (R-7.1.4-H1); it is not used`
            )
        },
        continuous: hooks
    })
}

export function effectFor(power: CardPower): EffectDefinition | undefined {
    assert(effects.size > 0, POWERS_NOT_LOADED)
    return effects.get(powerKey(power.cardId, power.powerIndex))
}

export function hasEffect(power: CardPower): boolean {
    return effectFor(power) !== undefined
}

export function chosen<K extends PowerChoiceKind>(
    ctx: Pick<EffectContext, 'choices'>,
    kind: K
): Extract<PowerChoice, { kind: K }>[] {
    return ctx.choices.filter(
        (choice): choice is Extract<PowerChoice, { kind: K }> => choice.kind === kind
    )
}

export function registerPersistent(cardId: string, index: number, hooks: PersistentHooks): void {
    registerEffect(cardId, index, {
        choices: [],
        resolve: () => {
            throw Error(
                `${cardId} is a persistent power (R-7.1.4): it applies on its own and is never used`
            )
        },
        persistent: hooks
    })
}
