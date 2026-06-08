import type React from 'react'
import type { SourceControlAiSettings } from '../../../../shared/source-control-ai-types'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import {
  CUSTOM_COMMAND_MODE_INHERIT,
  CUSTOM_COMMAND_MODE_REPO
} from './repository-source-control-ai-labels'

type RepositorySourceControlAiCustomCommandProps = {
  value: string | undefined
  source: SourceControlAiSettings
  onChange: (value: string | undefined) => void
}

export function RepositorySourceControlAiCustomCommand({
  value,
  source,
  onChange
}: RepositorySourceControlAiCustomCommandProps): React.JSX.Element {
  const hasRepoCommand = typeof value === 'string' && value.trim().length > 0
  const mode = hasRepoCommand ? CUSTOM_COMMAND_MODE_REPO : CUSTOM_COMMAND_MODE_INHERIT
  return (
    <div className="space-y-2 rounded-md border border-border px-3 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <Label className="text-xs font-medium">Custom command</Label>
          <p className="text-[11px] text-muted-foreground">
            Repo fallback for text actions that select Custom command.
          </p>
        </div>
        <Select
          value={mode}
          onValueChange={(nextMode) => {
            onChange(
              nextMode === CUSTOM_COMMAND_MODE_REPO
                ? (value ?? source.customAgentCommand)
                : undefined
            )
          }}
        >
          <SelectTrigger size="sm" className="h-8 w-full text-xs sm:w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CUSTOM_COMMAND_MODE_INHERIT}>Use global</SelectItem>
            <SelectItem value={CUSTOM_COMMAND_MODE_REPO}>Repository command</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Input
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={source.customAgentCommand || 'e.g. ollama run llama3.1 {prompt}'}
        spellCheck={false}
        className="h-8 font-mono text-xs"
      />
    </div>
  )
}
