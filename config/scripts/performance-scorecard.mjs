import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const TERMINAL_BATCH_BENCHMARK = path.join(SCRIPT_DIR, 'pty-batch-flush-benchmark.mjs')
const DEFAULT_FORMAT = 'markdown'
const QUICK_RUNS = '8'

function usage() {
  return [
    'Usage: node config/scripts/performance-scorecard.mjs [options]',
    '',
    'Options:',
    '  --quick              Run fewer benchmark iterations for local smoke checks.',
    '  --format <format>    Output format: markdown or json.',
    '  --markdown           Shortcut for --format markdown.',
    '  --json               Shortcut for --format json.',
    '  --out <path>         Write the report to a file instead of stdout.',
    '  --fail-on-warn       Exit with code 1 when a check reports warnings.',
    '  --help               Print this help text.'
  ].join('\n')
}

export function parsePerformanceScorecardArgs(argv) {
  const options = {
    quick: false,
    format: DEFAULT_FORMAT,
    out: null,
    failOnWarn: false,
    help: false
  }

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--quick') {
      options.quick = true
    } else if (arg === '--') {
      continue
    } else if (arg === '--markdown') {
      options.format = 'markdown'
    } else if (arg === '--json') {
      options.format = 'json'
    } else if (arg === '--format') {
      const value = argv[++index]
      if (!value || !['markdown', 'json'].includes(value)) {
        throw new Error('--format must be markdown or json')
      }
      options.format = value
    } else if (arg === '--out') {
      const value = argv[++index]
      if (!value) {
        throw new Error('--out requires a path')
      }
      options.out = value
    } else if (arg === '--fail-on-warn') {
      options.failOnWarn = true
    } else if (arg === '--help') {
      options.help = true
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return options
}

function runNodeJson(scriptPath, envOverrides) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      env: { ...process.env, ...envOverrides },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${path.basename(scriptPath)} exited with code ${code}\n${stderr}`))
        return
      }
      try {
        resolve(JSON.parse(stdout))
      } catch (error) {
        reject(
          new Error(
            `${path.basename(scriptPath)} did not emit valid JSON: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        )
      }
    })
  })
}

function numberOrZero(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function ms(value) {
  return `${numberOrZero(value).toFixed(3)} ms`
}

function ratio(value) {
  return `${numberOrZero(value).toFixed(2)}x`
}

function statusFromWarnings(warnings) {
  return warnings.length > 0 ? 'warn' : 'pass'
}

function metric(label, value, target) {
  return { label, value, target }
}

function createTerminalStreamBatchingCheck(benchmark) {
  const legacyRuntimeMedian = numberOrZero(benchmark.runtimeIngress?.legacyRepeatedScans?.median)
  const currentRuntimeMedian = numberOrZero(benchmark.runtimeIngress?.currentFastPath?.median)
  const runtimeMedianReduction =
    legacyRuntimeMedian > 0 && currentRuntimeMedian > 0
      ? legacyRuntimeMedian / currentRuntimeMedian
      : 0
  const runtimeMaxReduction = numberOrZero(benchmark.runtimeIngress?.estimatedReduction)
  const firstSliceMax = numberOrZero(benchmark.bounded?.firstSlice?.max)
  const maxSliceMax = numberOrZero(benchmark.bounded?.maxSlice?.max)
  const totalDrainMax = numberOrZero(benchmark.bounded?.totalDrain?.max)
  const inputDelay = benchmark.bounded?.inputTimerDelay
    ? numberOrZero(benchmark.bounded.inputTimerDelay.max)
    : null
  const warnings = []

  if (runtimeMedianReduction > 0 && runtimeMedianReduction < 1.5) {
    warnings.push('Runtime ingress median fast path is below the 1.5x synthetic reduction target.')
  }
  if (firstSliceMax > 8) {
    warnings.push('The first bounded PTY slice exceeded the 8 ms target.')
  }
  if (maxSliceMax > 16) {
    warnings.push('A bounded PTY slice exceeded the 16 ms target.')
  }
  if (inputDelay !== null && inputDelay > 50) {
    warnings.push('Input timer delay exceeded the 50 ms local smoke target.')
  }

  return {
    id: 'terminal-stream-batching',
    title: 'Terminal Stream Batching',
    status: statusFromWarnings(warnings),
    signal: 'PTY output batching and runtime ingress scans',
    summaryMetric: ratio(runtimeMedianReduction),
    warnings,
    metrics: [
      metric('Runtime ingress median reduction', ratio(runtimeMedianReduction), '>= 1.5x'),
      metric('Runtime ingress max reduction', ratio(runtimeMaxReduction), 'Track only'),
      metric('Bounded first slice max', ms(firstSliceMax), '<= 8 ms'),
      metric('Bounded any slice max', ms(maxSliceMax), '<= 16 ms'),
      metric('Bounded total drain max', ms(totalDrainMax), 'Track only'),
      metric(
        'Bounded input timer delay max',
        inputDelay === null ? 'not measured' : ms(inputDelay),
        '<= 50 ms'
      )
    ],
    details: {
      scenario: benchmark.scenario,
      legacy: benchmark.legacy,
      bounded: benchmark.bounded,
      runtimeIngress: benchmark.runtimeIngress,
      estimatedPtyWriteDelay: benchmark.estimatedPtyWriteDelay
    }
  }
}

function platformInfo() {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch
  }
}

export function createPerformanceScorecard({
  terminalBatchBenchmark,
  generatedAt = new Date(),
  platform = platformInfo()
}) {
  const checks = [createTerminalStreamBatchingCheck(terminalBatchBenchmark)]
  const warnings = checks.flatMap((check) =>
    check.warnings.map((warning) => ({ checkId: check.id, warning }))
  )

  return {
    generatedAt: generatedAt.toISOString(),
    platform,
    status: statusFromWarnings(warnings),
    checks
  }
}

function markdownEscape(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function table(headers, rows) {
  return [
    `| ${headers.map(markdownEscape).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(markdownEscape).join(' | ')} |`)
  ].join('\n')
}

function renderCheck(check) {
  const lines = [
    `## ${check.title}`,
    '',
    table(
      ['Metric', 'Current', 'Target'],
      check.metrics.map((item) => [item.label, item.value, item.target])
    )
  ]

  if (check.warnings.length > 0) {
    lines.push('', 'Warnings:', '', ...check.warnings.map((warning) => `- ${warning}`))
  }

  return lines.join('\n')
}

export function renderMarkdownScorecard(scorecard) {
  const summaryRows = scorecard.checks.map((check) => [
    check.id,
    check.status,
    check.signal,
    check.summaryMetric
  ])

  return [
    '# Orca Performance Scorecard',
    '',
    `Generated at: ${scorecard.generatedAt}`,
    `Status: ${scorecard.status}`,
    '',
    '## Environment',
    '',
    table(
      ['Node', 'Platform', 'Arch'],
      [[scorecard.platform.node, scorecard.platform.platform, scorecard.platform.arch]]
    ),
    '',
    '## Summary',
    '',
    table(['Check', 'Status', 'Signal', 'Key Metric'], summaryRows),
    '',
    ...scorecard.checks.map(renderCheck)
  ].join('\n')
}

async function writeOutput(outputPath, content) {
  await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true })
  await writeFile(outputPath, `${content}\n`, 'utf8')
}

async function runScorecard(options) {
  const terminalBatchBenchmark = await runNodeJson(
    TERMINAL_BATCH_BENCHMARK,
    options.quick ? { ORCA_PTY_BENCH_RUNS: process.env.ORCA_PTY_BENCH_RUNS ?? QUICK_RUNS } : {}
  )
  const scorecard = createPerformanceScorecard({ terminalBatchBenchmark })
  const output =
    options.format === 'json'
      ? JSON.stringify(scorecard, null, 2)
      : renderMarkdownScorecard(scorecard)

  if (options.out) {
    await writeOutput(options.out, output)
  } else {
    console.log(output)
  }

  if (options.failOnWarn && scorecard.status !== 'pass') {
    process.exitCode = 1
  }
}

async function main() {
  try {
    const options = parsePerformanceScorecardArgs(process.argv.slice(2))
    if (options.help) {
      console.log(usage())
      return
    }
    await runScorecard(options)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    console.error('')
    console.error(usage())
    process.exitCode = 1
  }
}

const isCliEntry = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false

if (isCliEntry) {
  await main()
}
