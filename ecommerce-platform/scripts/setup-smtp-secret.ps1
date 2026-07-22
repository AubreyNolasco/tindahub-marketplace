$ErrorActionPreference = 'Stop'

$targetPath = Join-Path $PSScriptRoot '..\.env.smtp.local'
do {
  $gmail = (Read-Host 'Enter JOM HUB sender Gmail address').Trim()
  if ($gmail -notmatch '^[^@\s]+@gmail\.com$') { Write-Host 'Enter a valid Gmail address.' -ForegroundColor Yellow }
} until ($gmail -match '^[^@\s]+@gmail\.com$')

do {
  $securePassword = Read-Host 'Enter the NEW 16-character Google App Password (input is hidden)' -AsSecureString
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  $appPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer).Replace(' ', '')
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  if ($appPassword.Length -ne 16) { Write-Host 'The App Password must contain 16 characters. Try again.' -ForegroundColor Yellow }
} until ($appPassword.Length -eq 16)

try {
  @(
    "SUPABASE_AUTH_SMTP_USER=$gmail"
    "SUPABASE_AUTH_SMTP_PASS=$appPassword"
  ) | Set-Content -LiteralPath $targetPath -Encoding utf8
  Write-Host 'Saved securely to the local Git-ignored file. You may close this window.' -ForegroundColor Green
} finally {
  $appPassword = $null
}
