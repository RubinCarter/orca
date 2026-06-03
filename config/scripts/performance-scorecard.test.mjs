import { describe, expect, it } from 'vitest'

import {
  createPerformanceScorecard,
  parsePerformanceScorecardArgs,
  renderMarkdownScorecard
} from './performance-scorecard.mjs'

function benchmark(overrides = {}) {
  return {
    scenario: {
      ptyCount: 24,
      payloadChars: 262144,
      runs: 8,
      totalPayloadMiB: 6,
      ingressChunks: 96,
      ingressChunkChars: 65536,
      ingressPayloadMiB: 6
    },
    legacy: {
      bytesPerRun: 6291456,
      singleCallback: { median: 1, p95: 2, max: 3 },
      inputTimerDelay: { median: 2, p95: 3, max: 4 }
    },
    bounded: {
      bytesPerRun: 6291456,
      firstSlice: { median: 0.1, p95: 0.2, max: 0.3 },
      maxSlice: { median: 0.2, p95: 0.4, max: 0.6 },
      totalDrain: { median: 2, p95: 3, max: 4 },
      inputTimerDelay: { median: 1, p95: 2, max: 3 }
    },
    runtimeIngress: {
      legacyRepeatedScans: { median: 30, p95: 35, max: 36 },
      currentFastPath: { median: 12, p95: 16, max: 18 },
      estimatedReduction: 2
    },
    estimatedPtyWriteDelay: { before: 4, after: 3, reduction: 1.3 },
    ...overrides
  }
}

describe('performance scorecard', () => {
  it('parses common CLI options', () => {
    expect(
      parsePerformanceScorecardArgs([
        '--',
        '--quick',
        '--json',
        '--out',
        'report.json',
        '--fail-on-warn'
      ])
    ).toEqual({
      quick: true,
      format: 'json',
      out: 'report.json',
      failOnWarn: true,
      help: false
    })
  })

  it('renders a markdown report for the terminal batching check', () => {
    const scorecard = createPerformanceScorecard({
      terminalBatchBenchmark: benchmark(),
      generatedAt: new Date('2026-06-03T12:00:00.000Z'),
      platform: { node: 'v25.0.0', platform: 'darwin', arch: 'arm64' }
    })

    expect(scorecard.status).toBe('pass')
    const markdown = renderMarkdownScorecard(scorecard)
    expect(markdown).toContain('# Orca Performance Scorecard')
    expect(markdown).toContain('| terminal-stream-batching | pass |')
    expect(markdown).toContain('| Runtime ingress median reduction | 2.50x | >= 1.5x |')
  })

  it('warns when the terminal batching reduction falls below the target', () => {
    const scorecard = createPerformanceScorecard({
      terminalBatchBenchmark: benchmark({
        runtimeIngress: {
          legacyRepeatedScans: { median: 30, p95: 35, max: 36 },
          currentFastPath: { median: 28, p95: 30, max: 32 },
          estimatedReduction: 1.1
        }
      })
    })

    expect(scorecard.status).toBe('warn')
    expect(scorecard.checks[0].warnings).toHaveLength(1)
  })
})
