import { assertExists, type GameAction, type Visibility } from '@tabletop/common'
import { AUSTERLITZ } from '../components/austerlitz.js'
import { Side } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { NapoleonsTriumphRuntime } from '../definition/runtime.js'
import { CommandKind, type MoveOrder } from '../model/attack.js'
import { FeintEnd } from '../model/attackDeclaration.js'
import type { NapoleonsTriumphGameState } from '../model/gameState.js'
import {
    TestGame,
    arrangeBattlefield,
    artillery,
    cavalry,
    infantry,
    passTurns,
    type PiecePlacement
} from './harness.js'

export const BATTLE_FROM = 93
export const BATTLE_INTO = 94
export const BATTLE_REFUGE = 83

/** A French turn with only the pieces of one attack on the map, keeping the actions played from then on. */
export class BattleGame extends TestGame {
    readonly played: GameAction[] = []
    private lastPlay?: { state: NapoleonsTriumphGameState; action: GameAction }

    constructor(placements: readonly PiecePlacement[], alliedMorale?: number) {
        super()
        this.deployBoth()
        passTurns(this, 1)
        arrangeBattlefield(this, placements)
        if (alliedMorale !== undefined) {
            this.arrange((state) => {
                state.playerOf(Side.Allied).morale = alliedMorale
            })
        }
        this.played.length = 0
    }

    protected override play(action: GameAction): GameAction[] {
        this.lastPlay = { state: this.canonical, action }
        const processed = super.play(action)
        this.played.push(...processed)
        return processed
    }

    /** The last action played again as its player's browser runs it: on that player's view of the game. */
    replayInPlayersView(): GameAction[] {
        assertExists(this.lastPlay, 'Expected an action to have been played')
        const { state, action } = this.lastPlay
        assertExists(action.playerId, 'Expected a player action')
        const perspective: Visibility.Perspective = { kind: 'player', playerId: action.playerId }
        const view = NapoleonsTriumphRuntime.visibility.state.project(state, perspective, {
            config: this.game.config
        })
        return this.engine.executeAction({ game: this.game, state: view, perspective, action })
            .processedActions
    }

    by(side: Side, type: ActionType, payload: Record<string, unknown> = {}) {
        return this.act(type, this.playerOf(side), payload)
    }

    threaten() {
        this.by(Side.French, ActionType.ThreatenAttack, {
            approach: AUSTERLITZ.approachBetween(BATTLE_FROM, BATTLE_INTO).id
        })
    }

    declare(orders: MoveOrder[], leaderIds: string[], wide = true) {
        this.by(Side.French, ActionType.DeclareAttack, { orders, wide, leaderIds })
    }

    pressAgainst(leaderIds: string[]) {
        this.by(Side.French, ActionType.PressAttack)
        this.by(Side.Allied, ActionType.LeadDefense, { leaderIds })
    }
}

export const attacker = (id: string, face: PiecePlacement['face'], more = {}): PiecePlacement => ({
    id,
    side: Side.French,
    face,
    locale: BATTLE_FROM,
    commanderId: 'st-hilaire',
    ...more
})

export const defender = (id: string, face: PiecePlacement['face'], more = {}): PiecePlacement => ({
    id,
    side: Side.Allied,
    face,
    locale: BATTLE_INTO,
    commanderId: 'prebyshevsky',
    ...more
})

export const stHilaire = (unitIds: string[]): MoveOrder[] => [
    { kind: CommandKind.Corps, commanderId: 'st-hilaire', unitIds }
]

const blocking = { facing: BATTLE_FROM }
const detachedGun = { commanderId: undefined, facing: BATTLE_INTO }

/** Thrown back by blockers, the defender declining to counter-attack, with nothing left to decide. */
export function repulsedByBlockers(): BattleGame {
    const game = new BattleGame([
        attacker('F01', infantry(2)),
        attacker('F02', infantry(2)),
        defender('A01', infantry(3), blocking),
        defender('A02', infantry(2), blocking),
        defender('A03', infantry(2))
    ])
    game.threaten()
    game.pressAgainst(['A01'])
    game.declare(stHilaire(['F01', 'F02']), ['F01'])
    game.by(Side.Allied, ActionType.CounterAttack, { unitIds: [] })
    return game
}

/** A strong attack on a defence from reserve that wins, left at the defender's retreat. */
export function wonBeforeTheRetreat(alliedMorale?: number): BattleGame {
    const game = new BattleGame(
        [
            attacker('F01', infantry(3)),
            attacker('F02', infantry(3)),
            attacker('F03', cavalry(2)),
            defender('A01', infantry(2)),
            defender('A02', infantry(1)),
            defender('A03', artillery()),
            defender('A04', infantry(3))
        ],
        alliedMorale
    )
    game.threaten()
    game.by(Side.Allied, ActionType.DeclareDefense, { unitIds: ['A01', 'A02'] })
    game.pressAgainst(['A01'])
    game.declare(stHilaire(['F01', 'F02', 'F03']), ['F01', 'F02'])
    game.by(Side.Allied, ActionType.CounterAttack, { unitIds: [] })
    return game
}

export function retreatToTheRefuge(game: BattleGame): BattleGame {
    game.by(Side.Allied, ActionType.Retreat, {
        losses: { A04: 2 },
        destinations: { A03: BATTLE_REFUGE, A04: BATTLE_REFUGE },
        kept: { prebyshevsky: 'A04' }
    })
    return game
}

/** A lone battery firing, settled by its declaration since nothing can counter-attack it. */
export function bombardment(): BattleGame {
    const game = new BattleGame([
        attacker('F01', artillery(), detachedGun),
        defender('A01', infantry(3))
    ])
    game.threaten()
    game.by(Side.Allied, ActionType.DeclareDefense, { unitIds: ['A01'] })
    game.pressAgainst([])
    game.declare([{ kind: CommandKind.Unit, unitIds: ['F01'] }], ['F01'], false)
    return game
}

/** A feint against blockers, which ends the attack at once since nobody has to advance. */
export function feintAgainstBlockers(): BattleGame {
    const game = new BattleGame([
        attacker('F01', infantry(3)),
        defender('A01', infantry(3), blocking)
    ])
    game.threaten()
    game.by(Side.French, ActionType.DeclareFeint, {
        orders: stHilaire(['F01']),
        end: FeintEnd.Reserve
    })
    return game
}

/** A feint against one detached unit in reserve, which the game advances to the approach by itself. */
export function feintAgainstOneReserve(): BattleGame {
    const game = new BattleGame([
        attacker('F01', infantry(3)),
        defender('A01', infantry(2), { commanderId: undefined })
    ])
    game.threaten()
    game.by(Side.Allied, ActionType.DeclareDefense, { unitIds: ['A01'] })
    game.by(Side.French, ActionType.DeclareFeint, {
        orders: stHilaire(['F01']),
        end: FeintEnd.Reserve
    })
    return game
}

/** A feint against a reserve of a detached unit and a corps's last unit, which advance with their commander. */
export function advanceWithTheCommanderAfterAFeint(): BattleGame {
    const game = new BattleGame([
        attacker('F01', infantry(3)),
        defender('A01', cavalry(3), { commanderId: undefined }),
        defender('A02', infantry(3))
    ])
    game.threaten()
    game.by(Side.Allied, ActionType.DeclareDefense, { unitIds: ['A01', 'A02'] })
    game.by(Side.French, ActionType.DeclareFeint, {
        orders: stHilaire(['F01']),
        end: FeintEnd.Reserve
    })
    game.by(Side.Allied, ActionType.Advance, {
        unitIds: ['A01', 'A02'],
        commanderIds: ['prebyshevsky']
    })
    return game
}

/** A defender that gives ground before the attack, at the attacker's move into the locale. */
export function retreatBeforeCombat(alliedMorale?: number): BattleGame {
    const game = new BattleGame(
        [attacker('F01', infantry(3)), defender('A01', infantry(3))],
        alliedMorale
    )
    game.threaten()
    game.by(Side.Allied, ActionType.Retreat, {
        losses: { A01: 2 },
        destinations: { A01: BATTLE_REFUGE },
        kept: {}
    })
    return game
}

export function moveIn(game: BattleGame): BattleGame {
    game.by(Side.French, ActionType.Occupy, { orders: stHilaire(['F01']) })
    return game
}

/** A battery whose threat the defender gave ground before, staying where it stands. */
export function gunsStayAfterARetreat(): BattleGame {
    const game = new BattleGame([
        attacker('F01', artillery(), detachedGun),
        defender('A01', infantry(3))
    ])
    game.threaten()
    game.by(Side.Allied, ActionType.Retreat, {
        losses: { A01: 2 },
        destinations: { A01: BATTLE_REFUGE },
        kept: {}
    })
    game.by(Side.French, ActionType.Occupy, {
        orders: [{ kind: CommandKind.Unit, unitIds: ['F01'] }],
        artilleryStays: true
    })
    return game
}

/** Thrown back by blockers, the attacker spreading its losses and then keeping a unit for its commander. */
export function regroupedAfterARepulse(): BattleGame {
    const game = new BattleGame([
        attacker('F01', infantry(3)),
        attacker('F02', infantry(3)),
        attacker('F03', infantry(3)),
        defender('A01', infantry(3), blocking),
        defender('A02', infantry(3), blocking)
    ])
    game.threaten()
    game.pressAgainst(['A01', 'A02'])
    game.declare(stHilaire(['F01', 'F02', 'F03']), ['F01'])
    game.by(Side.French, ActionType.AssignLosses, { allocation: { F02: 1, F03: 2 } })
    game.by(Side.French, ActionType.Regroup, { keep: { 'st-hilaire': 'F02' } })
    return game
}

/** A weak attack on a defence from reserve, which steps up to the approach once it has held. */
export function advanceAfterARepulse(): BattleGame {
    const game = new BattleGame([
        attacker('F01', infantry(2)),
        defender('A01', infantry(3)),
        defender('A02', infantry(3))
    ])
    game.threaten()
    game.by(Side.Allied, ActionType.DeclareDefense, { unitIds: ['A01', 'A02'] })
    game.pressAgainst(['A01'])
    game.declare(stHilaire(['F01']), ['F01'], false)
    game.by(Side.Allied, ActionType.CounterAttack, { unitIds: [] })
    game.by(Side.Allied, ActionType.Advance, { unitIds: ['A01'], commanderIds: [] })
    return game
}

/** A battery firing on blockers, whose loss the defender chooses. */
export function bombardmentLossChosen(): BattleGame {
    const game = new BattleGame([
        attacker('F01', artillery(), detachedGun),
        defender('A01', artillery(), blocking),
        defender('A02', infantry(2), blocking)
    ])
    game.threaten()
    game.pressAgainst(['A01'])
    game.declare([{ kind: CommandKind.Unit, unitIds: ['F01'] }], ['F01'], false)
    game.by(Side.Allied, ActionType.AssignLosses, { allocation: { A02: 1 } })
    return game
}

/** A won attack whose losses break the defending army before anyone retreats. */
export function brokenInCombat(): BattleGame {
    const game = new BattleGame([attacker('F01', infantry(3)), defender('A01', infantry(2))], 2)
    game.threaten()
    game.by(Side.Allied, ActionType.DeclareDefense, { unitIds: ['A01'] })
    game.pressAgainst([])
    game.declare(stHilaire(['F01']), ['F01'], false)
    game.by(Side.Allied, ActionType.CounterAttack, { unitIds: [] })
    return game
}
