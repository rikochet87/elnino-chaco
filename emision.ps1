<#
.SYNOPSIS
  Publica la emisión mensual del El Niño Argentina.

.DESCRIPTION
  Hace en orden: git pull, pipeline mensual (pronóstico, agua observada, índices y
  control de calidad), git add docs/data, git commit y git push. Si el control de
  calidad falla, se detiene y no sube nada.

.EXAMPLE
  .\emision.ps1 -ProbNino 1.0 -Intensidad "muy fuerte"
  Emisión del mes actual con la probabilidad de El Niño indicada (IRI/CPC).

.EXAMPLE
  .\emision.ps1 -UsarAnterior
  Repite la probabilidad y la intensidad de la última emisión publicada.

.EXAMPLE
  .\emision.ps1 -ProbNino 0.9 -Intensidad fuerte -Borrador
  Genera un borrador para revisar; no publica ni sube nada.

.EXAMPLE
  .\emision.ps1 -Programar
  Crea una tarea de Windows que corre el día 21 de cada mes a las 9:30 con -UsarAnterior.
#>
param(
  [string]$Emision = (Get-Date -Format "yyyy-MM"),
  [double]$ProbNino = -1,
  [string]$Intensidad = "",
  [switch]$UsarAnterior,
  [switch]$Borrador,
  [switch]$Programar
)

# Los comandos externos (git, python) se controlan con $LASTEXITCODE: con "Stop", Windows
# PowerShell trata como error cualquier mensaje que git escriba en stderr.
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
$py = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
$log = Join-Path $PSScriptRoot "pipeline\datos\emision.log"
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null

function Paso($texto) { Write-Host "`n== $texto" -ForegroundColor Cyan }
function Falla($texto) { Write-Host "ERROR: $texto" -ForegroundColor Red; Stop-Transcript | Out-Null; exit 1 }

if ($Programar) {
  $tarea = "SIG El Nino - emision mensual"
  $ruta = $PSCommandPath
  if ($ruta -match " ") { Write-Host "La ruta del proyecto tiene espacios; creá la tarea a mano desde el Programador de tareas." -ForegroundColor Red; exit 1 }
  $accion = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ruta -UsarAnterior"
  schtasks /Create /F /SC MONTHLY /D 21 /ST 09:30 /TN $tarea /TR $accion | Out-Host
  if ($LASTEXITCODE -ne 0) { Write-Host "No se pudo crear la tarea." -ForegroundColor Red; exit 1 }
  Write-Host "Tarea creada: el día 21 de cada mes a las 9:30 (la PC tiene que estar encendida)." -ForegroundColor Green
  Write-Host "Para quitarla: schtasks /Delete /TN `"$tarea`" /F"
  exit 0
}

Start-Transcript -Path $log -Append | Out-Null
Write-Host "Emisión $Emision - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"

if (-not (Test-Path $py)) { Falla "No encuentro el entorno .venv. Crealo con: python -m venv .venv ; .venv\Scripts\pip install -r requirements.txt" }

if ($UsarAnterior) {
  try {
    $actual = Get-Content "docs\data\emision-actual.json" -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json
    $previa = Get-Content (Join-Path "docs\data" $actual.archivo) -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json
  } catch { Falla "No pude leer la emisión anterior en docs\data: $_" }
  if ($ProbNino -lt 0) { $ProbNino = [double]$previa.prob_nino }
  if (-not $Intensidad) { $Intensidad = $previa.intensidad }
  Write-Host "Se reutilizan los valores de la emisión $($previa.emision): P(Niño) = $ProbNino, intensidad $Intensidad" -ForegroundColor Yellow
  Write-Host "Si IRI/CPC publicó un pronóstico nuevo, conviene correr con -ProbNino y -Intensidad." -ForegroundColor Yellow
}
if ($ProbNino -lt 0 -or $ProbNino -gt 1) { Falla "Indicá -ProbNino entre 0 y 1 (pronóstico ENSO de IRI/CPC) o usá -UsarAnterior." }
if (-not $Intensidad) { $Intensidad = "sin definir" }
$prob = $ProbNino.ToString([System.Globalization.CultureInfo]::InvariantCulture)

Paso "1/4 Actualizando el proyecto (git pull)"
git pull --ff-only
if ($LASTEXITCODE -ne 0) { Falla "git pull falló. Revisá si hay cambios locales sin subir (git status)." }

Paso "2/4 Corriendo el pipeline"
$argumentos = @("-m", "pipeline", "mensual", "--emision", $Emision, "--prob-nino", $prob, "--intensidad", $Intensidad)
if ($Borrador) { $argumentos += "--borrador" }
& $py @argumentos
if ($LASTEXITCODE -ne 0) { Falla "El pipeline no terminó bien (ver arriba). No se publicó nada." }

if ($Borrador) {
  Write-Host "`nBorrador listo en pipeline\datos. No se subió nada." -ForegroundColor Green
  Stop-Transcript | Out-Null
  exit 0
}

Paso "3/4 Guardando los cambios (git commit)"
git add docs/data
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host "No hay cambios en los datos: la web ya tiene esta emisión." -ForegroundColor Yellow
  Stop-Transcript | Out-Null
  exit 0
}
git commit -m "Emisión $Emision (P(Niño) $prob, $Intensidad)"
if ($LASTEXITCODE -ne 0) { Falla "git commit falló." }

Paso "4/4 Subiendo a GitHub (git push)"
git push
if ($LASTEXITCODE -ne 0) { Falla "git push falló. Revisá la conexión o tus credenciales de GitHub." }

Write-Host "`nListo: emisión $Emision publicada. La web se actualiza en uno o dos minutos." -ForegroundColor Green
Stop-Transcript | Out-Null
