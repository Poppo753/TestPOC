<#
  Synchronizes the canonical Jethos documentation pack into web-readable
  Markdown. DOCX files are converted from their semantic Word styles; existing
  Markdown files are copied byte-for-byte. A JSON manifest drives the website.

  This script intentionally writes only the explicit files in content/docs.
  It never edits the canonical source pack.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$dappRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$sourceRoot = Join-Path $repoRoot 'docs\New_Doc\1_Documentation\jethos_docs_v0_1'
$outputRoot = Join-Path $dappRoot 'content\docs'
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

function Clean-WordText([string]$value) {
  return (($value -replace '[\r\a]', '') -replace '\u00A0', ' ').Trim()
}

function Escape-TableCell([string]$value) {
  return ((Clean-WordText $value) -replace '\|', '\|') -replace "`n", '<br>'
}

function Add-BlankLine($lines) {
  if ($lines.Count -gt 0 -and $lines[$lines.Count - 1] -ne '') { $lines.Add('') }
}

function Add-WordTable($lines, $table) {
  $rows = [System.Collections.Generic.List[object]]::new()
  try {
    foreach ($row in $table.Rows) {
      $cells = [System.Collections.Generic.List[string]]::new()
      foreach ($cell in $row.Cells) { $cells.Add((Escape-TableCell $cell.Range.Text)) }
      if ($cells.Count -gt 0) { $rows.Add($cells.ToArray()) }
    }
  } catch {
    # Complex merged tables are preserved as readable row text rather than
    # aborting the complete documentation synchronization.
    $rows.Clear()
    $text = Clean-WordText $table.Range.Text
    if ($text) { $rows.Add(@($text)) }
  }
  if ($rows.Count -eq 0) { return }
  $columnCount = ($rows | ForEach-Object { $_.Count } | Measure-Object -Maximum).Maximum
  if (-not $columnCount) { $columnCount = 1 }
  Add-BlankLine $lines
  # Word uses a single-cell, styled table for editorial callouts. Rendering it
  # as a Markdown quote keeps the intended hierarchy instead of showing a
  # meaningless one-column table in the website reader.
  if ($rows.Count -eq 1 -and $columnCount -eq 1) {
    $lines.Add("> **Nota:** $($rows[0][0])")
    Add-BlankLine $lines
    return
  }
  for ($rowIndex = 0; $rowIndex -lt $rows.Count; $rowIndex++) {
    $cells = [System.Collections.Generic.List[string]]::new()
    for ($column = 0; $column -lt $columnCount; $column++) {
      $cells.Add($(if ($column -lt $rows[$rowIndex].Count) { $rows[$rowIndex][$column] } else { '' }))
    }
    $lines.Add('| ' + ($cells -join ' | ') + ' |')
    if ($rowIndex -eq 0) { $lines.Add('| ' + ((1..$columnCount | ForEach-Object { '---' }) -join ' | ') + ' |') }
  }
  Add-BlankLine $lines
}

$categoryMap = @{
  '00' = 'Map'; '01' = 'Vision'; '02' = 'Product'; '03' = 'Architecture';
  '04' = 'Accounting'; '05' = 'Risk'; '06' = 'Automation'; '07' = 'Liquidity';
  '08' = 'Governance'; '09' = 'Multichain'; '10' = 'Roadmap'; '11' = 'Decisions';
  '12' = 'Evidence'
}
$manifest = [System.Collections.Generic.List[object]]::new()
$word = $null

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $docxFiles = Get-ChildItem -LiteralPath $sourceRoot -Filter '*.docx' |
    Where-Object { $_.BaseName -match '^(0[0-9]|1[01])_' } |
    Sort-Object Name

  foreach ($file in $docxFiles) {
    $document = $null
    try {
      $document = $word.Documents.Open($file.FullName, $false, $true)
      $lines = [System.Collections.Generic.List[string]]::new()
      $handledTables = [System.Collections.Generic.HashSet[int]]::new()
      $title = $null
      $subtitle = $null

      foreach ($paragraph in $document.Paragraphs) {
        $range = $paragraph.Range
        if ($range.Information(12)) { # wdWithInTable
          $table = $range.Tables.Item(1)
          $tableKey = [int]$table.Range.Start
          if ($handledTables.Add($tableKey)) { Add-WordTable $lines $table }
          continue
        }
        $text = Clean-WordText $range.Text
        if (-not $text) { Add-BlankLine $lines; continue }
        $style = [string]$range.Style.NameLocal
        if ($text -eq 'JETHOS PROTOCOL' -and -not $title) { continue }

        switch -Regex ($style) {
          '^Title$' { $title = $text; Add-BlankLine $lines; $lines.Add("# $text"); Add-BlankLine $lines; break }
          '^Subtitle$' { $subtitle = $text; $lines.Add("> $text"); Add-BlankLine $lines; break }
          '^Heading 1$' { Add-BlankLine $lines; $lines.Add("## $text"); Add-BlankLine $lines; break }
          '^Heading 2$' { Add-BlankLine $lines; $lines.Add("### $text"); Add-BlankLine $lines; break }
          '^Heading 3$' { Add-BlankLine $lines; $lines.Add("#### $text"); Add-BlankLine $lines; break }
          '^List Bullet' { $lines.Add("- $text"); break }
          '^List Number' { $lines.Add("1. $text"); break }
          'Callout' { Add-BlankLine $lines; $lines.Add("> **Nota:** $text"); Add-BlankLine $lines; break }
          'Code' { Add-BlankLine $lines; $lines.Add('```text'); $lines.Add($text); $lines.Add('```'); Add-BlankLine $lines; break }
          default { $lines.Add($text); Add-BlankLine $lines }
        }
      }

      $id = [regex]::Match($file.BaseName, '^\d{2}').Value
      $outputName = $file.BaseName + '.md'
      $outputPath = Join-Path $outputRoot $outputName
      $markdown = (($lines -join "`n") -replace "(`n){3,}", "`n`n").Trim() + "`n"
      [System.IO.File]::WriteAllText($outputPath, $markdown, [System.Text.UTF8Encoding]::new($false))
      $manifest.Add([ordered]@{
        id = $id; title = $(if ($title) { $title } else { $file.BaseName });
        subtitle = $(if ($subtitle) { $subtitle } else { '' }); category = $categoryMap[$id];
        file = $outputName; source = $file.Name; sourceType = 'DOCX synchronized'
      })
      Write-Output "Synchronized $($file.Name) -> $outputName"
    } finally {
      if ($document) { $document.Close($false) }
    }
  }
} finally {
  if ($word) { $word.Quit() }
}

$markdownFiles = Get-ChildItem -LiteralPath $sourceRoot -Filter '*.md' |
  Where-Object { $_.BaseName -match '^\d{2}_' } | Sort-Object Name
foreach ($file in $markdownFiles) {
  $id = [regex]::Match($file.BaseName, '^\d{2}').Value
  $destination = Join-Path $outputRoot $file.Name
  Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
  # Windows PowerShell 5.1 treats BOM-less UTF-8 as the active ANSI codepage
  # when using Get-Content. Read explicitly as UTF-8 so typographic dashes and
  # accented Italian remain intact in the generated manifest.
  $sourceMarkdown = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
  $firstHeading = $sourceMarkdown -split "`r?`n" | Where-Object { $_ -match '^#\s+' } | Select-Object -First 1
  $title = $(if ($firstHeading) { $firstHeading -replace '^#\s+', '' } else { $file.BaseName })
  $manifest.Add([ordered]@{
    id = $id; title = $title; subtitle = 'Repository-derived findings and remaining decisions';
    category = $categoryMap[$id]; file = $file.Name; source = $file.Name; sourceType = 'Markdown source'
  })
  Write-Output "Copied $($file.Name)"
}

$sortedDocuments = @($manifest | Sort-Object { [int]$_['id'] })
$manifestObject = [ordered]@{
  version = '0.1'; generatedAt = (Get-Date).ToString('o');
  source = 'docs/New_Doc/1_Documentation/jethos_docs_v0_1';
  documents = $sortedDocuments
}
$manifestJson = $manifestObject | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText((Join-Path $outputRoot 'manifest.json'), $manifestJson + "`n", [System.Text.UTF8Encoding]::new($false))
Write-Output "Documentation manifest: $($manifest.Count) documents."
