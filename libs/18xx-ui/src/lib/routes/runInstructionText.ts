import type { IgnorableRunInstructionStop, RunInstructionStopReason } from '@tabletop/18xx'

export const runStopText: Record<RunInstructionStopReason, string> = {
    'train-lost': 'it lost a train',
    'run-lowered': 'its run earns less than when you set it',
    'routes-unsolved': 'could not determine updated routes',
    'routes-stale': 'could not determine updated routes',
    'payout-unavailable': 'it cannot pay out',
    'must-buy-train': 'it must buy a train',
    'president-changed': 'its president changed'
}

export const ignorableRunStops: Record<
    IgnorableRunInstructionStop,
    { label: string; condition: string; noun: string }
> = {
    'train-lost': { label: 'Train loss', condition: 'it loses a train', noun: 'lost trains' },
    'run-lowered': {
        label: 'Lower run',
        condition: 'its run earns less than when you set it',
        noun: 'lower runs'
    }
}

export const alwaysRunStops = ['it must buy a train', 'its president changes']
