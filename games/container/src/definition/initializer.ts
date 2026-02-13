import {
    type GameInitializer,
    BaseGameInitializer,
    Prng,
    type UninitializedGameState,
    Game,
    Player,
    HydratedTurnManager,
    shuffle,
    assertExists
} from '@tabletop/common'
import { ContainerGameState, HydratedContainerGameState } from '../model/gameState.js'
import {
    ContainerPlayerState,
    HydratedContainerPlayerState
} from '../model/playerState.js'
import { MachineState } from './states.js'
import { ContainerPlayerColors } from './colors.js'
import {
    CONTAINER_COLORS,
    DEFAULT_VALUE_CARDS,
    STARTING_MONEY,
    SUPPLY_BY_PLAYER_COUNT
} from './constants.js'
import { ContainerColor } from '../model/container.js'
import { ContainerGameConfig } from './config.js'
import { InvestmentBank } from '../model/investmentBank.js'

export class ContainerGameInitializer
    extends BaseGameInitializer<ContainerGameState, HydratedContainerGameState>
    implements GameInitializer<ContainerGameState, HydratedContainerGameState>
{
    initializeExplorationState(state: ContainerGameState): ContainerGameState {
        return state
    }

    initializeGameState(
        game: Game,
        state: UninitializedGameState
    ): HydratedContainerGameState {
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng)

        const turnManager = HydratedTurnManager.generate(players, prng.random)
        const orderedPlayers: ContainerPlayerState[] = []
        for (const playerId of turnManager.turnOrder) {
            const player = players.find((p) => p.playerId === playerId)
            if (player) {
                orderedPlayers.push(player)
            }
        }

        const playerCount = game.players.length as 3 | 4 | 5
        const supplyConfig = SUPPLY_BY_PLAYER_COUNT[playerCount]
        const containerSupply: Record<ContainerColor, number> = {
            [ContainerColor.Purple]: supplyConfig.containersPerColor,
            [ContainerColor.Brown]: supplyConfig.containersPerColor,
            [ContainerColor.Blue]: supplyConfig.containersPerColor,
            [ContainerColor.Red]: supplyConfig.containersPerColor,
            [ContainerColor.Green]: supplyConfig.containersPerColor
        }
        const machineSupply: Record<ContainerColor, number> = {
            [ContainerColor.Purple]: supplyConfig.machinesPerColor,
            [ContainerColor.Brown]: supplyConfig.machinesPerColor,
            [ContainerColor.Blue]: supplyConfig.machinesPerColor,
            [ContainerColor.Red]: supplyConfig.machinesPerColor,
            [ContainerColor.Green]: supplyConfig.machinesPerColor
        }

        const machineBag = [...CONTAINER_COLORS]
        shuffle(machineBag, prng.random)

        const valueCards = structuredClone(DEFAULT_VALUE_CARDS)
        shuffle(valueCards, prng.random)

        for (const player of orderedPlayers) {
            const machineColor = machineBag.pop()
            assertExists(machineColor, 'Machine supply exhausted during setup')
            machineSupply[machineColor] -= 1
            player.machines.push(machineColor)

            if (containerSupply[machineColor] <= 0) {
                throw new Error('Container supply exhausted during setup')
            }
            containerSupply[machineColor] -= 1
            player.factoryStore.push({ color: machineColor, price: 2 })

            player.warehouses = 1
            const valueCard = valueCards.pop()
            assertExists(valueCard, 'Value card supply exhausted during setup')
            player.valueCard = valueCard
        }

        const config = game.config as ContainerGameConfig
        const useInvestmentBank = config.useInvestmentBank ?? true
        let investmentBank: InvestmentBank | undefined
        if (useInvestmentBank) {
            const brokerDraw = [...CONTAINER_COLORS]
            shuffle(brokerDraw, prng.random)

            const brokerOneFirst = brokerDraw.pop()
            assertExists(brokerOneFirst, 'Broker container draw empty')
            const brokerOneSecond = brokerDraw.pop()
            assertExists(brokerOneSecond, 'Broker container draw empty')
            const brokerTwoOnly = brokerDraw.pop()
            assertExists(brokerTwoOnly, 'Broker container draw empty')

            const brokerOne = [brokerOneFirst, brokerOneSecond]
            const brokerTwo = [brokerTwoOnly]

            const personalHarbors: Record<string, ContainerColor[]> = {}
            for (const player of orderedPlayers) {
                personalHarbors[player.playerId] = []
            }

            investmentBank = {
                brokers: [
                    { containers: brokerOne, money: 1 },
                    { containers: brokerTwo, money: 2 },
                    { containers: [], money: 3 }
                ],
                paymentCard: undefined,
                personalHarbors
            }
        }

        const gameState: ContainerGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.TakingActions,
            turnManager,
            supply: {
                containers: containerSupply,
                machines: machineSupply,
                warehouses: supplyConfig.warehouses - orderedPlayers.length
            },
            actionsRemaining: 0,
            producedThisTurn: false,
            interestPaidThisTurn: false,
            turnNeedsStart: true,
            endTriggered: false,
            auction: undefined,
            seizure: undefined,
            investmentBank,
            brokerAuctionWonThisTurn: false,
            calledBrokerThisTurn: false
        })

        return new HydratedContainerGameState(gameState)
    }

    private initializePlayers(game: Game, prng: Prng): ContainerPlayerState[] {
        const colors = structuredClone(ContainerPlayerColors)
        shuffle(colors, prng.random)

        return game.players.map((player: Player, index: number) => {
            return new HydratedContainerPlayerState({
                playerId: player.id,
                color: colors[index],
                money: STARTING_MONEY,
                loans: 0,
                score: 0,
                machines: [],
                warehouses: 0,
                factoryStore: [],
                harborStore: [],
                ship: { location: { type: 'open_sea' }, cargo: [] },
                island: [],
                valueCard: DEFAULT_VALUE_CARDS[0]
            })
        })
    }
}
