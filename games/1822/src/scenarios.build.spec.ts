import { writeFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import {
    EarningsDistribution,
    finiteCashOwnedBy,
    getCompany,
    privateOwningCompany,
    trainRoutesOf,
    trainsCountingForLimit,
    trainsOwnedBy,
    type TrainRoute
} from '@tabletop/18xx'
import { Autorouter } from '@tabletop/18xx-autorouter'
import { assertExists } from '@tabletop/common'
import { botMove, Random } from '../test/bot.js'
import { kit, prepared, type Table } from '../test/kit.js'
import { company, giveCharter, player, runMinor, setCash, stepTo } from '../test/positions.js'
import { minorAcquisitions1822 } from './acquisition.js'
import { EarningsRules1822, TrainRules1822 } from './operating.js'
import {
    acquirablePrivates1822,
    acquisitionChoices1822,
    privateAgreementPlayerId1822
} from './privateAcquisition.js'
import { HumberBridgePrivateId, MailContractPrivateIds, TaxHavenPrivateId } from './privates.js'
import { RouteRules1822 } from './routes.js'
import { ScenarioIds1822 } from './scenarioCatalog.js'
import {
    ElectricTrainId,
    LocalTrainId,
    Phases1822,
    PullmanTrainId,
    TrainDepot1822
} from './trains.js'

// Writes the harness's scenarios from seeded bot games: run with SCENARIOS=1.
const folder = new URL('../../1822-ui/src/scenarios/', import.meta.url)

/** How long a game may run to reach a position of the late phases. */
const LateGame = 2000

// The first of the seeded games to reach the position within a harness-sized history.
function playUntil(players: number, seed: number, done: (game: Table) => boolean, limit = 1100) {
    for (let tried = seed; tried < seed + 80; tried++) {
        const game = kit.table(players, tried)
        const random = new Random(tried)
        for (let count = 0; count < limit && !done(game); count++) {
            if (game.state.machineState === 'GameOver') break
            const next = botMove(game, random)
            game.act(next.type, next.fields, next.playerId)
        }
        if (done(game)) return game
    }
    throw new Error('The position never came')
}

function save(slug: string, game: Table) {
    // Each scenario is its own local game.
    const id = `scenario-1822-${slug}`
    const file = {
        game: { ...game.game, id, name: slug.replace(/-/g, ' ') },
        state: { ...game.state, gameId: id },
        actions: game.actions.map((action) => ({ ...action, gameId: id }))
    }
    writeFileSync(new URL(`${slug}.json`, folder), JSON.stringify(file))
}

const operatingCompany = (game: Table) =>
    game.state.trackStep?.companyId ?? game.state.routeStep?.companyId
const runs = (game: Table, definitionId: string) => {
    const companyId = game.state.routeStep?.companyId
    return (
        game.state.machineState === 'RunningTrains' &&
        !!companyId &&
        trainsOwnedBy(game.state, { kind: 'company', companyId }).some(
            (train) => train.definitionId === definitionId
        )
    )
}

const autorouter = await Autorouter.create(
    new Uint8Array(
        await readFile(
            createRequire(import.meta.url).resolve('@tabletop/18xx-autorouter/solver.wasm')
        )
    ).buffer
)

/** The run the bot would make now. */
const bestRoutes = (game: Table): TrainRoute[] => {
    const companyId = game.state.routeStep?.companyId
    return companyId
        ? trainRoutesOf(
              autorouter.solve(game.state, RouteRules1822, companyId, { timeLimitMs: 150 }).result
          )
        : []
}

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
describe.skipIf(!process.env.SCENARIOS)('1822 harness scenarios', () => {
    it('writes the first stock round', { timeout: 900_000 }, () => {
        save('first-stock-round', kit.table(4, 1))
    })

    it('writes the first stock round of 1822+', { timeout: 900_000 }, () => {
        save('first-stock-round-of-1822-plus', kit.table(4, 1, { plus: true }))
    })

    it.each(ScenarioIds1822)('writes the opening of the %s scenario', (scenario) => {
        save(`${scenario}-scenario`, kit.table(4, 1, { scenario }))
    })

    it('writes the Humber bridge to lay', { timeout: 900_000 }, () => {
        const game = prepared(
            (state, [first]) => {
                runMinor(state, 'M9', first, { cash: 100 })
                kit.giveTrain(state, 'M9', '2')
                giveCharter(state, HumberBridgePrivateId, company('M9'))
            },
            { config: { plus: true, allPrivates: true }, seed: 1, phaseId: '3' }
        )
        stepTo(game, 'LayingTrack', 'M9')
        save('humber-bridge-to-lay', game)
    })

    it('writes a tax haven with money to spend', { timeout: 900_000 }, () => {
        const haven = company(TaxHavenPrivateId)
        const game = prepared(
            (state, [first, second]) => {
                for (const companyId of ['CR', 'GWR', 'NBR']) {
                    kit.operated(state, companyId, second, { price: 100, shares: 4, cash: 400 })
                    kit.giveTrain(state, companyId, '2')
                }
                giveCharter(state, TaxHavenPrivateId, player(first))
                const share = state.certificates.find(
                    (entry) => entry.companyId === 'CR' && entry.kind === 'share' && entry.poolId
                )
                assertExists(share, 'The Caledonian has a share in its treasury')
                share.owner = haven
                delete share.poolId
                setCash(state, haven, 250)
            },
            { config: { taxHavenShares: true }, seed: 1, phaseId: '3' }
        )
        save('tax-haven-with-money', game)
    })

    it('writes bids under way', { timeout: 900_000 }, () => {
        save(
            'bids-under-way',
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'StockRound' &&
                    game.state.bidBoxes.bids.length >= 7 &&
                    game.valid().includes('PlaceBids')
            )
        )
    })

    it('writes a concession to convert', { timeout: 900_000 }, () => {
        save(
            'concession-to-convert',
            playUntil(
                4,
                2,
                (game) =>
                    game.state.machineState === 'StockRound' &&
                    !Phases1822.isAtLeast(game.state.phaseId, '5') &&
                    game.valid().includes('StartCompany')
            )
        )
    })

    it('writes minor companies running L trains', { timeout: 900_000 }, () => {
        save(
            'minors-with-l-trains',
            playUntil(
                4,
                3,
                (game) =>
                    game.state.phaseId === '1' &&
                    runs(game, LocalTrainId) &&
                    bestRoutes(game).some((route) => route.paths.length > 0)
            )
        )
    })

    it('writes an L train at one station', { timeout: 900_000 }, () => {
        save(
            'l-train-at-one-station',
            playUntil(
                4,
                11,
                (game) =>
                    runs(game, LocalTrainId) &&
                    bestRoutes(game).some((route) => route.paths.length === 0)
            )
        )
    })

    it('writes a Pullman to attach', { timeout: 900_000 }, () => {
        save(
            'pullman-to-attach',
            playUntil(
                4,
                12,
                (game) =>
                    runs(game, PullmanTrainId) &&
                    bestRoutes(game).some((route) => route.attachmentIds?.length),
                LateGame
            )
        )
    })

    it('writes a major company laying track', { timeout: 900_000 }, () => {
        save(
            'major-laying-track',
            playUntil(4, 4, (game) => {
                const companyId = operatingCompany(game)
                return (
                    game.state.machineState === 'LayingTrack' &&
                    !game.state.trackStep?.lays.length &&
                    !!companyId &&
                    getCompany(game.state, companyId).kind === 'major' &&
                    Phases1822.isAtLeast(game.state.phaseId, '3')
                )
            })
        )
    })

    it('writes a loan for a train', { timeout: 900_000 }, () => {
        save(
            'loan-for-a-train',
            playUntil(4, 4, (game) => {
                const companyId = game.state.trainPurchaseStep?.companyId
                if (!companyId || !game.valid().includes('FundTrain')) return false
                const director = getCompany(game.state, companyId).president
                if (director?.kind !== 'player') return false
                const prices = TrainRules1822.availableDefinitions(game.hydrated).map(
                    (definitionId) => TrainDepot1822.trainDefinition(definitionId).price
                )
                // Neither the treasury nor its director's cash reaches the cheapest train.
                return (
                    finiteCashOwnedBy(game.state, { kind: 'company', companyId }) +
                        finiteCashOwnedBy(game.state, director) <
                    Math.min(...prices)
                )
            })
        )
    })

    it('writes a director’s certificate for sale', { timeout: 900_000 }, () => {
        save(
            'directors-certificate-for-sale',
            playUntil(
                4,
                6,
                (game) =>
                    game.state.machineState === 'StockRound' &&
                    Phases1822.isAtLeast(game.state.phaseId, '5') &&
                    game.valid().includes('StartCompany'),
                LateGame
            )
        )
    })

    it('writes a minor company’s first turn', { timeout: 900_000 }, () => {
        save(
            'minors-first-turn',
            playUntil(4, 8, (game) => game.valid().includes('BuyLocalTrain'))
        )
    })

    it('writes the Metropolitan Railway choosing its home', { timeout: 900_000 }, () => {
        save(
            'metropolitan-home',
            playUntil(4, 13, (game) => game.valid().includes('PlaceMetropolitanHome'))
        )
    })

    it('writes a private company to acquire', { timeout: 900_000 }, () => {
        save(
            'private-to-acquire',
            playUntil(4, 9, (game) => game.valid().includes('AcquirePrivate'))
        )
    })

    it('writes a minor company to acquire', { timeout: 900_000 }, () => {
        save(
            'minor-to-acquire',
            playUntil(4, 10, (game) => game.valid().includes('AcquireMinor'), LateGame)
        )
    })

    it('writes an offer for another director’s minor company', { timeout: 900_000 }, () => {
        const offered = (game: Table) => {
            const [playerId] = game.state.activePlayerIds
            return playerId
                ? minorAcquisitions1822(game.hydrated, playerId).find(
                      (offer) => offer.agreementPlayerId
                  )
                : undefined
        }
        const game = playUntil(4, 1, (game) => !!offered(game), LateGame)
        const offer = offered(game)
        assertExists(offer, 'The position has an offer to make')
        const [terms] = offer.terms.toSorted((a, b) => b.shares - a.shares)
        const [token] = offer.tokens
        assertExists(terms, 'An acquisition has terms')
        const excess = [
            ...trainsCountingForLimit(game.hydrated, TrainRules1822, offer.companyId),
            ...trainsCountingForLimit(game.hydrated, TrainRules1822, offer.minorId)
        ].slice(0, offer.excessTrains)
        game.act('AcquireMinor', {
            companyId: offer.companyId,
            minorId: offer.minorId,
            shares: terms.shares,
            token,
            discardTrainIds: excess.map((train) => train.id)
        })
        save('offer-for-a-minor', game)
    })

    it('writes a loan to repay', { timeout: 900_000 }, () => {
        save(
            'loan-to-repay',
            playUntil(4, 1, (game) => game.valid().includes('RepayPlayerLoan'), LateGame)
        )
    })

    it('writes a permanent train’s dividend', { timeout: 900_000 }, () => {
        save(
            'permanent-train-dividend',
            playUntil(
                4,
                1,
                (game) => {
                    const companyId = game.state.routeStep?.companyId
                    return (
                        game.state.machineState === 'DistributingEarnings' &&
                        !!companyId &&
                        new EarningsDistribution(game.hydrated, EarningsRules1822).separateRevenue(
                            companyId
                        ) > 0
                    )
                },
                LateGame
            )
        )
    })

    it('writes a request for another player’s private company', { timeout: 900_000 }, () => {
        const asked = (game: Table) => {
            const [playerId] = game.state.activePlayerIds
            const companyId = game.state.trackStep?.companyId
            if (!playerId || !companyId || !game.valid().includes('AcquirePrivate'))
                return undefined
            return acquirablePrivates1822(game.hydrated, playerId).find(
                (entry) =>
                    privateAgreementPlayerId1822(game.hydrated, companyId, entry.id) &&
                    !acquisitionChoices1822(game.hydrated, companyId, entry.id).length &&
                    entry.id !== 'P1'
            )
        }
        const game = playUntil(4, 1, (game) => !!asked(game), LateGame)
        const entry = asked(game)
        const companyId = game.state.trackStep?.companyId
        assertExists(entry, 'The position has a private company to ask for')
        assertExists(companyId, 'A company is laying track')
        game.act('AcquirePrivate', { companyId, privateCompanyId: entry.id })
        save('request-for-a-private', game)
    })

    it('writes a request to lay track beside London', { timeout: 900_000 }, () => {
        save(
            'track-beside-london',
            playUntil(4, 1, (game) => !!game.state.trackConsent, LateGame)
        )
    })

    it('writes a mail contract to run for', { timeout: 900_000 }, () => {
        save(
            'mail-contract-run',
            playUntil(
                4,
                1,
                (game) => {
                    const companyId = game.state.routeStep?.companyId
                    return (
                        game.state.machineState === 'RunningTrains' &&
                        !!companyId &&
                        MailContractPrivateIds.some(
                            (id) => privateOwningCompany(game.state, id) === companyId
                        ) &&
                        bestRoutes(game).filter((route) => route.paths.length > 2).length > 1
                    )
                },
                LateGame
            )
        )
    })

    it('writes an E train running', { timeout: 900_000 }, () => {
        save(
            'e-train-running',
            playUntil(4, 7, (game) => runs(game, ElectricTrainId), LateGame)
        )
    })
})
