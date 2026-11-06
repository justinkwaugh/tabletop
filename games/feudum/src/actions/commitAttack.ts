import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import type { Good } from '../data/components.js'
import type { WritId } from '../data/writs.js'
import { ActionType } from '../definition/actions.js'
import { saltpeterAllowed, type CombatStrength } from '../model/combatStrength.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import {
    canCoverWithWildTiles,
    canPayGoods,
    payGoods,
    WildTileSpend,
    type GoodPrice
} from '../model/payments.js'
import { ComponentCount, WritIdSchema } from '../model/stateSchemas.js'
import { putWritsUnderInView } from '../model/writDeck.js'
import { writRegistry } from '../writs/writRegistry.js'
import { CombatRecord, conquerVp, resolveCombat, strengthOf } from './combat.js'

/** R-4.4-H1 A weapon writ played into the attack, by its printed alternative. */
const WeaponPlay = Type.Object({
    writId: WritIdSchema,
    alternative: Type.Integer({ minimum: 0 })
})

export type CommitAttackMetadata = Type.Static<typeof CommitAttackMetadata>
export const CommitAttackMetadata = Type.Evaluate(
    Type.Intersect([
        CombatRecord,
        Type.Object({
            /** R-4.8.2 Each weapon's strength; R-4.4.2 the deck slot it went under at, in view. */
            weaponStrengths: Type.Array(
                Type.Object({ writId: WritIdSchema, attack: ComponentCount, slot: ComponentCount })
            )
        })
    ])
)

export type CommitAttack = Type.Static<typeof CommitAttack>
export const CommitAttack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.CommitAttack),
            playerId: Type.String(),
            /** R-4.8.2 */
            saltpeter: ComponentCount,
            weapons: Type.Array(WeaponPlay),
            /** R-4.4-H1, R-4.8-H6 Tiles cover the saltpeter or a weapon's turn-in. */
            wildTiles: Type.Optional(Type.Array(WildTileSpend)),
            metadata: Type.Optional(CommitAttackMetadata)
        })
    ])
)

export const CommitAttackValidator = Compile(CommitAttack)

export function isCommitAttack(action?: GameAction): action is CommitAttack {
    return action?.type === ActionType.CommitAttack
}

export type CommitAttackInput = Readonly<Pick<CommitAttack, 'saltpeter' | 'weapons' | 'wildTiles'>>

/** R-4.4-H1 What the saltpeter and the weapons' turn-ins cost together. */
function commitmentPrice({ saltpeter, weapons }: CommitAttackInput): GoodPrice {
    const price: Partial<Record<Good, number>> = { saltpeter }
    for (const { writId, alternative } of weapons) {
        for (const good of writRegistry.weaponBonus(writId, alternative)?.turnedIn ?? []) {
            price[good] = (price[good] ?? 0) + 1
        }
    }
    return price
}

/** R-4.8.2 The weapons' total. */
function weaponsAttack(weapons: CommitAttack['weapons']): number {
    return weapons.reduce(
        (sum, { writId, alternative }) =>
            sum + (writRegistry.weaponBonus(writId, alternative)?.attack ?? 0),
        0
    )
}

/** R-4.4-H1 */
function reasonWeaponsRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    weapons: CommitAttack['weapons']
): string | undefined {
    const held = state.getPlayerState(playerId).requireWrits()
    for (const [index, { writId, alternative }] of weapons.entries()) {
        if (!held.includes(writId)) {
            return "You don't hold that writ."
        }
        if (weapons.findIndex((weapon) => weapon.writId === writId) !== index) {
            return 'Each writ plays once.'
        }
        const refused = writRegistry.reasonWeaponRefused(writId, alternative)
        if (refused) {
            return refused
        }
    }
    return undefined
}

/** R-4.8.2, R-4.4-H1 */
export function reasonCommitAttackRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    input: CommitAttackInput
): string | undefined {
    const combat = state.flow.combat
    if (combat?.attackerId !== playerId) {
        return 'No attack of yours is waiting.'
    }
    if (!saltpeterAllowed(state, playerId, combat.spaceId, input.saltpeter)) {
        return 'Only an attacking knight may add more than one saltpeter.'
    }
    return (
        reasonWeaponsRefused(state, playerId, input.weapons) ??
        (canPayGoods(state, playerId, commitmentPrice(input), input.wildTiles)
            ? undefined
            : "You can't pay for that.")
    )
}

/** R-4.4-H1 One way to use a held weapon. */
export interface WeaponOffer {
    readonly writId: WritId
    readonly alternative: number
    readonly attack: number
    readonly turnedIn: readonly Good[]
}

/** R-4.8.2 What the attacker may add (S36). */
export interface CommitAttackOffer {
    readonly saltpeterMost: number
    readonly weapons: readonly WeaponOffer[]
    /** R-4.8.2 With nothing added. */
    readonly strength: CombatStrength
}

/** R-4.8.2 The most saltpeter the seat may add: goods and tiles, one without a knight. */
function saltpeterMost(state: HydratedFeudumGameState, playerId: string): number {
    const combat = state.flow.combat
    assertExists(combat, 'R-4.8 A combat is under way')
    const { goods, regionTiles } = state.getPlayerState(playerId)
    const payable = goods.saltpeter + Math.min(regionTiles.length, state.supply.haversack.saltpeter)
    return saltpeterAllowed(state, playerId, combat.spaceId, payable) ? payable : 1
}

/** R-4.8.2, R-4.4-H1 Read-only. An offer exists for the attacker alone. */
export function commitAttackOffer(
    state: HydratedFeudumGameState,
    playerId: string
): CommitAttackOffer | undefined {
    const combat = state.flow.combat
    if (combat?.attackerId !== playerId) {
        return undefined
    }
    const weapons = state
        .getPlayerState(playerId)
        .requireWrits()
        .flatMap((writId): WeaponOffer[] => {
            const offers: WeaponOffer[] = []
            for (
                let alternative = 0, bonus = writRegistry.weaponBonus(writId, alternative);
                bonus;
                alternative += 1, bonus = writRegistry.weaponBonus(writId, alternative)
            ) {
                const price: Partial<Record<Good, number>> = {}
                for (const good of bonus.turnedIn) {
                    price[good] = (price[good] ?? 0) + 1
                }
                if (canCoverWithWildTiles(state, playerId, price)) {
                    offers.push({
                        writId,
                        alternative,
                        attack: bonus.attack,
                        turnedIn: bonus.turnedIn
                    })
                }
            }
            return offers
        })
    return {
        saltpeterMost: saltpeterMost(state, playerId),
        weapons,
        strength: strengthOf(state, combat, 0, 0)
    }
}

/** R-4.8.2 The real rule on a partial commitment, for the chip (S36). */
export interface CommitAttackPreview {
    readonly refused?: string
    readonly strength: CombatStrength
    /** R-3.13.1 What it scores as things would stand. */
    readonly vp: number
}

/** R-4.8.2 Read-only, and for the attacker alone. */
export function commitAttackPreview(
    state: HydratedFeudumGameState,
    playerId: string,
    input: Partial<CommitAttackInput>
): CommitAttackPreview | undefined {
    const combat = state.flow.combat
    if (combat?.attackerId !== playerId) {
        return undefined
    }
    const full = { saltpeter: 0, weapons: [], ...input }
    const refused = reasonCommitAttackRefused(state, playerId, full)
    const strength = strengthOf(state, combat, full.saltpeter, weaponsAttack(full.weapons))
    return {
        ...(refused ? { refused } : {}),
        strength,
        vp: strength.attackerWins ? conquerVp(combat.target) : 0
    }
}

export class HydratedCommitAttack
    extends HydratableAction<typeof CommitAttack>
    implements CommitAttack
{
    declare type: ActionType.CommitAttack
    declare playerId: string
    declare saltpeter: number
    declare weapons: CommitAttack['weapons']
    declare wildTiles?: CommitAttack['wildTiles']
    declare metadata?: CommitAttackMetadata

    constructor(data: CommitAttack) {
        super(data, CommitAttackValidator)
    }

    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const refused = reasonCommitAttackRefused(state, this.playerId, this)
        if (refused) {
            throw Error(refused)
        }
        payGoods(state, this.playerId, commitmentPrice(this), this.wildTiles)
        const attack = weaponsAttack(this.weapons)
        const weaponStrengths = this.weapons.map(({ writId, alternative }) => {
            const bonus = writRegistry.weaponBonus(writId, alternative)
            assertExists(bonus, 'R-4.4-H1 A legal weapon is registered')
            const player = state.getPlayerState(this.playerId)
            const writs = player.requireWrits()
            writs.splice(writs.indexOf(writId), 1)
            player.writCount -= 1
            const slot = state.writDeck.nextBottom
            putWritsUnderInView(state, [writId])
            return { writId, attack: bonus.attack, slot }
        })
        const combat = resolveCombat(state, this.saltpeter, attack)
        this.metadata = { ...combat, weaponStrengths }
    }
}
