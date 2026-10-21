// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startingPositionFile } from '@tabletop/common/testing'
import { getCompany } from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import { EighteenThirtyTwoTrainDepot, formSystem } from '@tabletop/1832'
import { EighteenThirtyTwoScenarios } from '@tabletop/1832/scenarios'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')

function write(slug, name, play) {
    const file = startingPositionFile({ slug, name, game: play.game, state: play.state })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

/**
 * AMTK, formed from the ACL and CG, at its train step in phase 4 with one 4-train, $100 in its
 * treasury and $600 with its president, so it cannot buy the $300 4-train alone (§11.6.7).
 */
function systemTrainHelp() {
    const play = playExample(EighteenThirtyTwoScenarios, 'funding', 3)
    const state = structuredClone(play.state)
    state.phaseId = '4'
    const cg = getCompany(state, 'CG').president
    formSystem(state, ['ACL', 'CG'], cg.playerId)
    const president = getCompany(state, 'AMTK').president.playerId
    const amtk = { kind: 'company', companyId: 'AMTK' }
    const train = EighteenThirtyTwoTrainDepot.nextTrain(state.trainInventory, '4')
    EighteenThirtyTwoTrainDepot.purchase(state.trainInventory, train.id, '4', amtk)
    for (const cash of state.cash) {
        if (cash.owner.kind === 'company' && cash.owner.companyId === 'AMTK') cash.amount = 100
        if (cash.owner.kind === 'player' && cash.owner.playerId === president) cash.amount = 600
    }
    state.operatingSet.companyOrder = ['AMTK']
    state.trainPurchaseStep = { companyId: 'AMTK', purchasedTrainIds: [] }
    state.activePlayerIds = [president]
    state.turnManager.series = [{ type: 'turn', playerId: president, start: 0 }]
    play.replaceState(state)
    return play
}

mkdirSync(OUT, { recursive: true })
write('system-train-help', 'System train help', systemTrainHelp())
