$ErrorActionPreference = "Stop"
$baseUrl = "http://localhost:3000"
$sesion = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$ptr = [IntPtr]::Zero
$ptrConfirmacion = [IntPtr]::Zero
$claveAdmin = $null
$claveNueva = $null
$token = $null

function Convertir-Clave {
    param([System.Security.SecureString]$Segura)

    $p = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Segura)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)
    }
}

function Solicitar-Texto {
    param([string]$Etiqueta)

    do {
        $valor = (Read-Host $Etiqueta).Trim()
        if ([string]::IsNullOrWhiteSpace($valor)) {
            Write-Host "Este campo es obligatorio." -ForegroundColor Yellow
        }
    } while ([string]::IsNullOrWhiteSpace($valor))

    return $valor
}

function Seleccionar-Registro {
    param(
        [object[]]$Registros,
        [string]$Etiqueta
    )

    while ($true) {
        $busqueda = Read-Host "Buscar $Etiqueta por nombre"
        $coincidencias = @(
            $Registros | Where-Object {
                $_.detalle -like "*$busqueda*"
            }
        )

        if ($coincidencias.Count -eq 0) {
            Write-Host "No hay coincidencias. Prueba otra busqueda." -ForegroundColor Yellow
            continue
        }

        $coincidencias |
            Select-Object id, detalle, grado, nivelJerarquico |
            Format-Table -AutoSize |
            Out-Host

        $idTexto = Read-Host "ID del $Etiqueta que deseas seleccionar"
        $idElegido = 0

        if (-not [int]::TryParse($idTexto, [ref]$idElegido)) {
            Write-Host "Introduce un ID numerico." -ForegroundColor Yellow
            continue
        }

        $elegido = $coincidencias |
            Where-Object { $_.id -eq $idElegido } |
            Select-Object -First 1

        if ($null -ne $elegido) {
            return $elegido
        }

        Write-Host "Selecciona un ID de los resultados mostrados." -ForegroundColor Yellow
    }
}

try {
    $salud = Invoke-RestMethod -Uri "$baseUrl/salud" -Method Get
    if ($salud.estado -ne "ok") {
        throw "El backend no esta saludable."
    }

    Write-Host "`n=== REGISTRO DE USUARIO DE PRUEBA ===" -ForegroundColor Cyan
    Write-Host "1. Jefe de area (JEFE_AREA)"
    Write-Host "2. Empleado (EMPLEADO)"

    do {
        $opcion = Read-Host "Selecciona el perfil que vas a crear (1 o 2)"
    } while ($opcion -notin @("1", "2"))

    if ($opcion -eq "1") {
        $rol = "JEFE_AREA"
    }
    else {
        $rol = "EMPLEADO"
    }

    $csrf = Invoke-RestMethod -Uri "$baseUrl/api/auth/csrf" `
        -Method Get -WebSession $sesion

    Write-Host "`nAutenticacion del SUPERADMIN local" -ForegroundColor Cyan
    $correoAdmin = Solicitar-Texto "Correo del SUPERADMIN"
    $claveAdminSegura = Read-Host "Contrasena del SUPERADMIN" -AsSecureString
    $claveAdmin = Convertir-Clave $claveAdminSegura

    $cuerpoLogin = @{
        correo = $correoAdmin
        clave = $claveAdmin
    } | ConvertTo-Json

    $login = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" `
        -Method Post -WebSession $sesion `
        -Headers @{ "X-CSRF-Token" = $csrf.csrfToken } `
        -ContentType "application/json" -Body $cuerpoLogin

    $token = $login.accessToken
    if ([string]::IsNullOrWhiteSpace($token)) {
        throw "La API no devolvio un token de acceso."
    }

    $cabeceras = @{
        Authorization = "Bearer $token"
        "X-CSRF-Token" = $csrf.csrfToken
    }

    $areasRespuesta = Invoke-RestMethod `
        -Uri "$baseUrl/api/organizacion/areas" `
        -Headers $cabeceras -WebSession $sesion

    $cargosRespuesta = Invoke-RestMethod `
        -Uri "$baseUrl/api/organizacion/cargos" `
        -Headers $cabeceras -WebSession $sesion

    $areas = @($areasRespuesta.areas)
    $cargos = @($cargosRespuesta.cargos)

    if ($areas.Count -eq 0 -or $cargos.Count -eq 0) {
        throw "La API no devolvio areas o cargos disponibles."
    }

    Write-Host "`nDatos personales" -ForegroundColor Cyan
    do {
        $cedula = Solicitar-Texto "Cedula (10 digitos)"
        if ($cedula -notmatch '^\d{10}$') {
            Write-Host "La cedula debe contener exactamente 10 digitos." -ForegroundColor Yellow
        }
    } while ($cedula -notmatch '^\d{10}$')

    $nombres = Solicitar-Texto "Nombres"
    $apellidos = Solicitar-Texto "Apellidos"

    do {
        $correo = Solicitar-Texto "Correo del nuevo usuario"
        $correo = $correo.ToLowerInvariant()
        if ($correo -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
            Write-Host "Introduce un correo valido." -ForegroundColor Yellow
        }
    } while ($correo -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$')

    $telefono = Read-Host "Telefono (Enter si no tiene)"
    if ([string]::IsNullOrWhiteSpace($telefono)) {
        $telefonoValor = $null
    }
    else {
        $telefonoValor = $telefono.Trim()
    }

    Write-Host "`nSeleccion de area" -ForegroundColor Cyan
    $area = Seleccionar-Registro -Registros $areas -Etiqueta "area"

    Write-Host "`nSeleccion de cargo" -ForegroundColor Cyan
    $cargo = Seleccionar-Registro -Registros $cargos -Etiqueta "cargo"

    $jefeId = $null
    if ($rol -eq "EMPLEADO") {
        do {
            $jefeTexto = Read-Host "ID del JEFE_AREA ya registrado al que se vinculara"
            $jefeId = 0
            $jefeValido = [int]::TryParse($jefeTexto, [ref]$jefeId) -and $jefeId -gt 0
            if (-not $jefeValido) {
                Write-Host "Introduce un ID numerico positivo." -ForegroundColor Yellow
            }
        } while (-not $jefeValido)
    }

    $fechaIngresoTexto = Read-Host "Fecha de ingreso AAAA-MM-DD (Enter para hoy)"
    if ([string]::IsNullOrWhiteSpace($fechaIngresoTexto)) {
        $fechaIngresoTexto = Get-Date -Format "yyyy-MM-dd"
    }

    $fechaValida = [DateTime]::MinValue
    $formatoValido = [DateTime]::TryParseExact(
        $fechaIngresoTexto,
        "yyyy-MM-dd",
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::None,
        [ref]$fechaValida
    )

    if (-not $formatoValido) {
        throw "Fecha invalida. Usa el formato AAAA-MM-DD."
    }

    Write-Host "`nClave de acceso del nuevo usuario" -ForegroundColor Cyan
    $claveSegura = Read-Host "Nueva contrasena" -AsSecureString
    $claveConfirmacionSegura = Read-Host "Repite la contrasena" -AsSecureString
    $claveNueva = Convertir-Clave $claveSegura
    $claveConfirmacion = Convertir-Clave $claveConfirmacionSegura

    if ($claveNueva -cne $claveConfirmacion) {
        throw "Las contrasenas no coinciden. No se envio la solicitud."
    }

    $payload = @{
        cedula = $cedula
        nombres = $nombres
        apellidos = $apellidos
        correo = $correo
        telefono = $telefonoValor
        areaId = [int]$area.id
        cargoId = [int]$cargo.id
        rol = $rol
        jefeInmediatoId = $jefeId
        fechaIngreso = $fechaIngresoTexto
        clave = $claveNueva
    }

    Write-Host "`nResumen antes de registrar:" -ForegroundColor Cyan
    [PSCustomObject]@{
        Nombres = "$nombres $apellidos"
        Correo = $correo
        Rol = $rol
        Area = $area.detalle
        Cargo = $cargo.detalle
        JefeInmediatoId = $jefeId
        FechaIngreso = $fechaIngresoTexto
    } | Format-List

    $confirmar = Read-Host "Escribe REGISTRAR para enviar los datos a la API"
    if ($confirmar -cne "REGISTRAR") {
        Write-Host "Registro cancelado; no se envio la solicitud." -ForegroundColor Yellow
        return
    }

    $cuerpoUsuario = $payload | ConvertTo-Json -Depth 5
    $resultado = Invoke-RestMethod -Uri "$baseUrl/api/usuarios" `
        -Method Post -WebSession $sesion `
        -Headers $cabeceras `
        -ContentType "application/json" `
        -Body $cuerpoUsuario

    Write-Host "`nUsuario registrado correctamente:" -ForegroundColor Green
    $resultado.usuario |
        Select-Object id, cedula, nombres, apellidos, correo, rol, area, cargo, jefeInmediato, estado |
        Format-List
}
catch {
    Write-Host "`nNo se pudo completar el registro." -ForegroundColor Red

    if ($_.ErrorDetails.Message) {
        try {
            $detalle = $_.ErrorDetails.Message | ConvertFrom-Json
            if ($detalle.message) {
                Write-Host $detalle.message
            }
            elseif ($detalle.error) {
                Write-Host $detalle.error
            }
            else {
                Write-Host $_.ErrorDetails.Message
            }
        }
        catch {
            Write-Host $_.ErrorDetails.Message
        }
    }
    else {
        Write-Host $_.Exception.Message
    }
}
finally {
    if ($ptr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
    if ($ptrConfirmacion -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptrConfirmacion)
    }

    $claveAdmin = $null
    $claveNueva = $null
    $token = $null
    $cuerpoLogin = $null
    $cuerpoUsuario = $null
    $login = $null
    $payload = $null
}
