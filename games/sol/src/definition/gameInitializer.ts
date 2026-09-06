import {
    type GameInitializer,
    type RandomFunction,
    BaseGameInitializer,
    Prng,
    PlayerState,
    assert,
    assertExists,
    type ExplorationPopulation,
    type GameAction,
    MachineContext,
    type UninitializedGameState
} from '@tabletop/common'
import { Game, Player, HydratedTurnManager, shuffle } from '@tabletop/common'
import { HydratedSolGameState, SolGameState } from '../model/gameState.js'
import { HydratedSolPlayerState, SolPlayerState } from '../model/playerState.js'

import { MachineState } from './states.js'
import { SolColors } from './colors.js'
import { SolGameConfig } from './gameConfig.js'
import { Sundiver } from '../components/sundiver.js'
import { SolarGate } from '../components/solarGate.js'
import { EnergyNode, StationType, SundiverFoundry, TransmitTower } from '../components/stations.js'
import { HydratedSolGameBoard } from '../components/gameBoard.js'
import { Suit } from '../components/cards.js'
import { HydratedDeck } from '../components/deck.js'
import { Effect, EffectColor, Effects, EffectType } from '../components/effects.js'
import { isDrawCards } from '../actions/drawCards.js'
import { SolarFlare } from '../actions/solarFlare.js'
import { PassContext } from '../actions/pass.js'
import { queueCardChoicePass, queueMotivatedActivation } from '../utils/automaticActions.js'

const MOTHERSHIP_SPACING = [0, 6, 4, 3, 3]

export class SolGameInitializer
    extends BaseGameInitializer<SolGameState, HydratedSolGameState>
    implements GameInitializer<SolGameState, HydratedSolGameState>
{
    initializeExplorationState(state: SolGameState): SolGameState {
        const hydratedState = new HydratedSolGameState(state)
        hydratedState.deck.shuffle()
        return hydratedState.dehydrate()
    }

    populateExplorationState({
        state,
        actions,
        random
    }: ExplorationPopulation<SolGameState>): SolGameState {
        const suits = Object.values(Suit).filter((suit) => state.effects[suit] !== undefined)
        const prng = new Prng({ seed: Math.floor(random() * 2 ** 32), invocations: 0 })
        const deck = HydratedDeck.create(suits, prng, random)
        const revealedIds = new Set<string>()
        for (const action of actions) {
            if (!isDrawCards(action)) continue
            assertExists(action.metadata, 'Exploration requires the revealed draw outcomes')
            for (const card of action.metadata.drawnCards) {
                assert(!revealedIds.has(card.id), 'Exploration contains a repeated card draw')
                revealedIds.add(card.id)
                const index = deck.items.findIndex((candidate) => candidate.suit === card.suit)
                assert(index >= 0, 'Revealed draws exceed the starting card population')
                deck.items.splice(index, 1)
            }
        }
        assert(
            deck.items.length === state.deck.remaining,
            'Exploration card count does not match the source'
        )
        for (const card of deck.items) {
            while (revealedIds.has(card.id)) card.id = prng.randId()
            revealedIds.add(card.id)
        }
        deck.remaining = deck.items.length
        deck.shuffle(random)
        return { ...state, deck: deck.dehydrate() }
    }

    getExplorationActions(game: Game, state: SolGameState): GameAction[] {
        const hydrated = new HydratedSolGameState(state)
        const context = new MachineContext({ gameConfig: game.config, gameState: hydrated })
        const playerId = hydrated.turnManager.currentTurn()?.playerId
        if (
            hydrated.machineState === MachineState.SolarFlares &&
            !hydrated.solarFlareActivationsGroupId
        ) {
            context.addSystemAction(SolarFlare)
        } else if (hydrated.machineState === MachineState.ChoosingCard) {
            assertExists(playerId, 'No player choosing a card')
            queueCardChoicePass(context, playerId, PassContext.NoCardChoice)
        } else if (
            hydrated.machineState === MachineState.Activating &&
            hydrated.activeEffect === EffectType.Motivate
        ) {
            assertExists(playerId, 'No player activating Motivate')
            if (!hydrated.getActivationForPlayer(playerId))
                queueMotivatedActivation(context, playerId)
        }
        Object.assign(state, hydrated.dehydrate())
        return context.getPendingActions()
    }

    initializeGameState(game: Game, state: UninitializedGameState): HydratedSolGameState {
        const prng = new Prng(state.prng)

        const players = this.initializePlayers(game, prng)
        const turnManager = HydratedTurnManager.generate(players, prng.random)
        // Put players array in turn order
        const orderedPlayers: SolPlayerState[] = []
        for (const playerId of turnManager.turnOrder) {
            const player = players.find((p) => p.playerId === playerId)
            if (player) {
                orderedPlayers.push(player)
            }
        }

        const nonFlareSuits = [
            Suit.Condensation,
            Suit.Expansion,
            Suit.Oscillation,
            Suit.Refraction,
            Suit.Reverberation,
            Suit.Subduction
        ]
        shuffle(nonFlareSuits, prng.random)
        const suits = [Suit.Flare, ...nonFlareSuits.slice(0, players.length + 1)]
        const deckPrngState = (state.systemVersion ?? 1) >= 3 ? state.protectedPrng : state.prng
        assertExists(deckPrngState, 'Protected deck initialization requires protectedPrng')
        const deckPrng = (state.systemVersion ?? 1) >= 3 ? new Prng(deckPrngState) : prng
        const deck = HydratedDeck.create(suits, prng, deckPrng.random)

        const config = game.config as SolGameConfig

        let allEffects = structuredClone(Effects)
        if (config.lowConflict) {
            allEffects = allEffects.filter(
                (effect) => effect.color !== EffectColor.Red && effect.type !== EffectType.Sacrifice
            )
        }
        if (config.noBlue) {
            allEffects = allEffects.filter((effect) => effect.color !== EffectColor.Blue)
        }
        if (config.noGreen) {
            allEffects = allEffects.filter((effect) => effect.color !== EffectColor.Green)
        }
        if (config.noYellow) {
            allEffects = allEffects.filter((effect) => effect.color !== EffectColor.Yellow)
        }
        shuffle(allEffects, prng.random)
        const effects: Record<string, Effect> = {}

        suits.forEach((suit, index) => {
            effects[suit] = allEffects[index]
        })

        const board = this.initializeBoard(orderedPlayers, prng.random)

        const solState: SolGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.StartOfTurn,
            turnManager: turnManager,
            board,
            deck,
            effects,
            instability: 13,
            energyCubes: 89,
            cardsToDraw: 0,
            solarFlares: 0,
            solarFlaresRemaining: 0,
            solarFlareActivations: [],
            hurled: false,
            paidPlayerIds: [],
            solarFlaresDrawnInGame: 0
        })

        return new HydratedSolGameState(solState)
    }

    private initializePlayers(game: Game, prng: Prng): SolPlayerState[] {
        const colors = structuredClone(SolColors)

        shuffle(colors, prng.random)

        const players = game.players.map((player: Player, index: number) => {
            const holdSundivers: Sundiver[] = []
            for (let i = 0; i < 8; i++) {
                holdSundivers.push({
                    id: prng.randId(),
                    playerId: player.id,
                    hold: player.id,
                    reserve: false
                })
            }

            const reserveSundivers: Sundiver[] = []
            for (let i = 0; i < 5; i++) {
                reserveSundivers.push({
                    id: prng.randId(),
                    playerId: player.id,
                    hold: undefined,
                    reserve: true
                })
            }

            const solarGates: SolarGate[] = []
            for (let i = 0; i < 5; i++) {
                solarGates.push({
                    id: prng.randId(),
                    playerId: player.id
                })
            }

            const energyNodes: EnergyNode[] = []
            for (let i = 0; i < 3; i++) {
                energyNodes.push({
                    type: StationType.EnergyNode,
                    id: prng.randId(),
                    playerId: player.id
                })
            }

            const sundiverFoundries: SundiverFoundry[] = []
            for (let i = 0; i < 3; i++) {
                sundiverFoundries.push({
                    type: StationType.SundiverFoundry,
                    id: prng.randId(),
                    playerId: player.id
                })
            }

            const transmitTowers: TransmitTower[] = []
            for (let i = 0; i < 3; i++) {
                transmitTowers.push({
                    type: StationType.TransmitTower,
                    id: prng.randId(),
                    playerId: player.id
                })
            }

            return new HydratedSolPlayerState({
                playerId: player.id,
                color: colors[index],
                score: 0,
                holdSundivers,
                reserveSundivers,
                energyCubes: 3,
                solarGates,
                energyNodes,
                sundiverFoundries,
                transmitTowers,
                movement: 3,
                movementPoints: 0,
                drawnCards: [],
                momentum: 0
            })
        })

        return players
    }

    private initializeBoard(players: PlayerState[], random: RandomFunction): HydratedSolGameBoard {
        const numPlayers = players.length
        const numMothershipPositions = numPlayers === 5 ? 16 : 13
        const spacing = MOTHERSHIP_SPACING[numPlayers - 1]
        const motherships: Record<string, number> = {}

        const randomOffset = Math.floor(random() * numMothershipPositions)
        let currentPos = randomOffset
        for (const player of players) {
            motherships[player.playerId] = currentPos
            currentPos = (currentPos + spacing) % numMothershipPositions
        }

        const board = new HydratedSolGameBoard({
            numPlayers,
            motherships,
            cells: {},
            gates: {}
        })

        return board
    }
}
