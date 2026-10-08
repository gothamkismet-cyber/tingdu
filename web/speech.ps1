param([ValidateSet('voices', 'speak')][string]$Mode = 'voices')
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Speech
$tingduSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $tingduVoices = @($tingduSynth.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object {
    [pscustomobject]@{ name = $_.VoiceInfo.Name; lang = $_.VoiceInfo.Culture.Name }
  })
  if ($Mode -eq 'voices') {
    [Console]::Write((ConvertTo-Json -InputObject $tingduVoices -Compress))
  } else {
    $tingduRequest = [Console]::In.ReadToEnd() | ConvertFrom-Json
    if ($tingduRequest.language -notin @('en', 'ja') -or !$tingduRequest.text -or $tingduRequest.text.Length -gt 300 -or $tingduRequest.rate -lt 0.5 -or $tingduRequest.rate -gt 1.5) { throw 'Invalid speech request' }
    $tingduVoice = $tingduVoices | Where-Object { $_.lang.StartsWith($tingduRequest.language) -and $_.name -eq $tingduRequest.voice } | Select-Object -First 1
    if (!$tingduVoice) { throw 'Voice unavailable' }
    $tingduSynth.SelectVoice($tingduVoice.name)
    $tingduMemory = New-Object System.IO.MemoryStream
    $tingduSynth.SetOutputToWaveStream($tingduMemory)
    $tingduEscaped = [System.Security.SecurityElement]::Escape([string]$tingduRequest.text)
    $tingduRate = ([int]([double]$tingduRequest.rate * 100)).ToString([System.Globalization.CultureInfo]::InvariantCulture)
    $tingduSsml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="' + $tingduVoice.lang + '"><prosody rate="' + $tingduRate + '%">' + $tingduEscaped + '</prosody></speak>'
    $tingduSynth.SpeakSsml($tingduSsml)
    $tingduBytes = $tingduMemory.ToArray()
    [Console]::OpenStandardOutput().Write($tingduBytes, 0, $tingduBytes.Length)
    $tingduMemory.Dispose()
  }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
} finally {
  $tingduSynth.Dispose()
}
