import * as React from 'react'
import type { ViewerProps } from '../viewer-registry'

const MonacoEditor = React.lazy(async () => {
  const mod = await import('@monaco-editor/react')
  return { default: mod.default }
})

function guessLanguage(filePath: string): string {
  const ext = filePath.lastIndexOf('.') >= 0 ? filePath.slice(filePath.lastIndexOf('.') + 1).toLowerCase() : ''
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    json: 'json', md: 'markdown', css: 'css', scss: 'scss', less: 'less',
    html: 'html', htm: 'html', xml: 'xml', svg: 'xml',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
    sh: 'shell', bash: 'shell', zsh: 'shell', ps1: 'powershell',
    yaml: 'yaml', yml: 'yaml', toml: 'ini', ini: 'ini',
    sql: 'sql', graphql: 'graphql', dockerfile: 'dockerfile',
    vue: 'html', svelte: 'html',
  }
  return map[ext] || 'plaintext'
}

export function FallbackViewer({ filePath, content, onContentChange }: ViewerProps): React.JSX.Element {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          Loading editor...
        </div>
      }
    >
      <MonacoEditor
        height="100%"
        language={guessLanguage(filePath)}
        theme="vs-dark"
        value={content}
        onChange={(value) => onContentChange?.(value ?? '')}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
        }}
      />
    </React.Suspense>
  )
}
