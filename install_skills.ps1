$ErrorActionPreference = "SilentlyContinue"
$targetDir = "C:\Users\menet\.gemini\antigravity\skills"

Write-Host "Iniciando varredura por skills perdidas no computador..."
Write-Host "Buscando em OneDrive, Documents, Downloads e na própria pasta .gemini..."

# Diretórios base para a busca
$searchPaths = @(
    "C:\Users\menet\OneDrive",
    "C:\Users\menet\Documents",
    "C:\Users\menet\Downloads",
    "C:\Users\menet\.gemini\antigravity\skills\skills"
)

# Encontra todos os arquivos SKILL.md
$skillFiles = Get-ChildItem -Path $searchPaths -Filter "SKILL.md" -Recurse

$count = 0

foreach ($file in $skillFiles) {
    $skillDir = $file.Directory
    $skillName = $skillDir.Name
    $dest = Join-Path -Path $targetDir -ChildPath $skillName
    
    # Ignora se já estiver na pasta raiz de skills
    if ($skillDir.FullName -eq $dest -or $skillDir.FullName -eq $targetDir) {
        continue
    }

    if (-not (Test-Path -Path $dest)) {
        Write-Host "Instalando a skill '$skillName' a partir de $($skillDir.FullName)"
        Copy-Item -Path $skillDir.FullName -Destination $dest -Recurse -Force
        $count++
    }
}

Write-Host "`nVarredura concluída! $count novas skills foram instaladas no Antigravity."
Write-Host "Você pode precisar reiniciar o meu contexto (abrir o painel lateral de Skills ou abrir um novo chat) para que eu carregue todas as novas habilidades!"
