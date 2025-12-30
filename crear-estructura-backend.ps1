# crear-estructura-backend.ps1
# Script para generar la estructura de carpetas y archivos inicial para el backend de NestJS.

# --- INSTRUCCIONES ---
# 1. Guarda este archivo como 'crear-estructura-backend.ps1' en la carpeta raíz de tu proyecto backend.
# 2. Abre una terminal de PowerShell en esa misma carpeta.
# 3. Ejecuta el script con el comando: .\crear-estructura-backend.ps1

Write-Host "🚀 Iniciando la creación de la estructura de carpetas para el backend..." -ForegroundColor Cyan

# --- CONFIGURACIÓN ---
# Directorio principal donde se crearán los módulos (usualmente 'src')
$baseDir = "src"

# Lista de módulos principales de la aplicación
$modules = @("users", "properties", "auth", "whatsapp", "leads")

# Subcarpetas estándar para cada módulo
$moduleSubDirs = @("dto", "schemas")

# Módulos compartidos o de utilidad
$sharedDirs = @{
    "common" = @("decorators", "filters", "guards", "interfaces", "pipes");
    "config" = @();
}

# --- EJECUCIÓN ---

# 1. Crear el directorio base si no existe
if (-not (Test-Path -Path $baseDir)) {
    Write-Host "Creando directorio base: '$baseDir'..."
    New-Item -ItemType Directory -Path $baseDir
}

# 2. Crear la estructura para cada módulo principal
foreach ($module in $modules) {
    $modulePath = Join-Path -Path $baseDir -ChildPath $module
    Write-Host "Creando módulo: '$module' en '$modulePath'"

    # Crear carpeta principal del módulo
    New-Item -ItemType Directory -Path $modulePath -Force | Out-Null

    # Crear subcarpetas (dto, schemas)
    foreach ($subDir in $moduleSubDirs) {
        $subDirPath = Join-Path -Path $modulePath -ChildPath $subDir
        New-Item -ItemType Directory -Path $subDirPath -Force | Out-Null
        # Crear un archivo .gitkeep para que la carpeta vacía sea rastreada por Git
        New-Item -ItemType File -Path (Join-Path -Path $subDirPath -ChildPath ".gitkeep") -Force | Out-Null
    }

    # Crear archivos base del módulo
    $filePrefix = $module.TrimEnd("s") # ej: users -> user, properties -> propertie (se ajusta manualmente si es necesario)
    if ($module -eq "properties") { $filePrefix = "property" }

    $filesToCreate = @(
        "$($module).module.ts",
        "$($module).controller.ts",
        "$($module).service.ts"
    )

    foreach ($file in $filesToCreate) {
        $filePath = Join-Path -Path $modulePath -ChildPath $file
        if (-not (Test-Path $filePath)) {
            New-Item -ItemType File -Path $filePath -Force | Out-Null
            Write-Host "  -> Creado archivo: $file" -ForegroundColor Gray
        }
    }
}

# 3. Crear carpetas compartidas/utilitarias
foreach ($dirEntry in $sharedDirs.GetEnumerator()) {
    $sharedDirPath = Join-Path -Path $baseDir -ChildPath $dirEntry.Name
    Write-Host "Creando directorio compartido: '$($dirEntry.Name)'"
    New-Item -ItemType Directory -Path $sharedDirPath -Force | Out-Null

    foreach ($subDir in $dirEntry.Value) {
        $subDirPath = Join-Path -Path $sharedDirPath -ChildPath $subDir
        New-Item -ItemType Directory -Path $subDirPath -Force | Out-Null
        New-Item -ItemType File -Path (Join-Path -Path $subDirPath -ChildPath ".gitkeep") -Force | Out-Null
    }
}

Write-Host "✅ ¡Estructura de carpetas creada con éxito!" -ForegroundColor Green
Write-Host "Tu proyecto NestJS ahora tiene una estructura modular lista para empezar a codificar."

# Read-Host "Proceso finalizado. Presiona Enter para salir" # Descomenta si quieres que la ventana no se cierre sola
