# CLAUDE.md — Sistema de Registro de Visitantes CAD

Contexto persistente para Claude Code. Lee este archivo completo antes de generar o modificar código. No reinventes decisiones ya tomadas: la base de datos en Supabase **ya está creada y poblada**. Tu trabajo es construir la aplicación SvelteKit que la consume.

---

## 1. Resumen del proyecto

Aplicación web para registrar a los visitantes de los CAD (Centros de Acceso Digital) de la región San Martín, Perú. La usan principalmente líderes digitales desde el **teléfono**; el superadmin la usa desde **PC**.

Objetivos de diseño:
- **Móvil primero** para el líder digital. Vista mínima, sin sobrecarga, pensada para teléfonos de gama baja con datos móviles.
- **Escritorio** para el superadmin (dashboard, gestión, exportación).
- **Toda la web en UTF-8.**
- **Todo el texto se almacena y se muestra en MAYÚSCULAS** (nombres, apellidos, etc.). La app debe convertir a mayúsculas automáticamente al guardar lo que escribe el usuario.
- Liviano en el dispositivo (por eso se eligió SvelteKit, no Next.js).

---

## 2. Stack y despliegue

- **Framework:** SvelteKit (TypeScript).
- **Backend / BD / Auth:** Supabase (proyecto dedicado, separado de otros proyectos).
- **Librerías Supabase:** `@supabase/supabase-js` y `@supabase/ssr`.
- **Despliegue:** Vercel. Usar `adapter-vercel` (o `adapter-auto`). Recordar cargar las variables de entorno en Vercel → Settings → Environment Variables al desplegar.
- **Exportación Excel:** generar `.xlsx` (p. ej. con la librería `xlsx` / SheetJS) solo en la vista superadmin.

### Variables de entorno (.env, ya creado)
```
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_PUBLISHABLE_KEY=...   # clave pública (navegador)
SUPABASE_SECRET_KEY=...               # clave secreta service_role (solo servidor, NUNCA al cliente)
```
- Formato de claves: **nuevo** de Supabase (publishable / secret).
- El cliente público del navegador usa `PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Operaciones de servidor que deben saltarse RLS (crear cuentas de líderes desde el panel admin, etc.) usan `SUPABASE_SECRET_KEY` en endpoints del lado servidor de SvelteKit. La clave secreta nunca debe llegar al navegador.

---

## 3. Perfiles / roles

Dos roles, guardados en la tabla `perfiles.rol`:

1. **superadmin**
   - Correo único y conocido: `isaias.lopez.burga@gmail.com`.
   - Contraseña: `SanMartin2026`.
   - Ve un dashboard, ve y gestiona todos los registros y usuarios, tiene todos los permisos.
   - Gestiona los 61 CADs (en BD hay 60 cargados actualmente; ver nota en §6) y las cuentas de líderes.
   - Filtra por CAD y rango de fechas (día / mes / año) y exporta a `.xlsx`.
   - No pertenece a ningún CAD (`cad_id` nulo).

2. **lider** (Líder digital)
   - Un líder digital **por cada CAD** (relación 1 líder ↔ 1 CAD vía `perfiles.cad_id`).
   - Registra los datos de los visitantes del CAD.
   - El superadmin crea sus cuentas (correo electrónico).
   - **Contraseña por defecto fija para todos los líderes:** `clave*2025` (no se fuerza cambio en primer ingreso; queda fija de forma intencional).
   - Inicio de sesión con **correo + contraseña**.
   - **Sesión persistente:** los datos de sesión se guardan en el navegador del teléfono; no debe volver a iniciar sesión al reabrir la web (salvo cierre manual o expiración larga).
   - Solo ve los registros **del día actual** (zona horaria America/Lima), no los de días anteriores.
   - En su lista solo visualiza: **DNI, nombre completo y estado** (`En curso` / `Finalizado`).
   - **No exporta.** **No borra ni edita** registros ya creados.

---

## 4. Reglas de negocio (críticas)

### Campos del reporte (orden del documento final)
`Nombre del CAD | Fecha | Nombre Completo | Edad | Género | Discapacidad | Tiempo de Uso (min) | Teléfono | DNI | Cargo/Profesión`

### Detalle por campo
- **Nombre del CAD:** uno de los 61 nombres, gestionados por el superadmin. El líder opera solo el suyo.
- **Fecha:** la pone el **sistema**, no el usuario. Es la fecha actual en **UTC-5 (America/Lima)**. Formato a mostrar/guardar/exportar: **DD/MM/AAAA**. (Internamente la BD guarda timestamps con zona horaria; el formato DD/MM/AAAA es de presentación/exportación.)
- **Nombre completo:** concatenación de `nombre` + " " + `apellido` (con espacio, legible). En MAYÚSCULAS.
- **Edad:** entero, solo números. Validar rango sensato (0–120).
- **Género:** lista desplegable con `Masculino` / `Femenino`.
- **Discapacidad:** pregunta "¿Cuenta con alguna discapacidad?" → desplegable `si` / `no`.
- **Tiempo de Uso (minutos):** ver §4.1.
- **Teléfono:** ver §4.2.
- **DNI:** ver §4.3.
- **Cargo/Profesión:** campo con **búsqueda por palabra clave** (autocompletar) sobre el catálogo `ocupaciones`. El usuario escribe y elige una de las ocupaciones registradas.

### 4.1 Tiempo de uso — flujo de entrada/salida (Opción A)
- El registro se crea al **ingreso** (se guarda `hora_entrada`).
- Luego el líder **busca a la persona** en la lista del día y marca **"Finalizar"**, que guarda `hora_salida` y calcula los minutos.
- **Se guardan tanto la hora de entrada como la de salida.**
- Cálculo: `minutos = redondeo_hacia_arriba((hora_salida - hora_entrada) en minutos)`.
- **Regla de mínimo 15:** si el resultado es **menor a 15**, se guarda **15**. Si es **15 o más**, se guarda el **valor real** (sin redondeo a bloques). Ejemplo: 14:20→16:20 = 120 min. Ejemplo: ingresó 17:55 y corte 18:00 = 5 min reales → se guarda 15.
- En BD esto lo implementa la función `public.calcular_minutos(entrada, salida)` que ya hace `greatest(15, ceil(diferencia_en_min))`.

### 4.1.1 Autocierre a las 18:00
- Si un visitante no se "Finaliza" hasta las **18:00 (hora Perú)**, el sistema cierra **todos** los registros en curso de ese día automáticamente.
- Implementado en BD con **pg_cron** (job `autocierre-cad-18h`) que corre a las **23:00 UTC = 18:00 America/Lima** y llama a `public.autocierre_18()`. Esa función cierra con `hora_salida = 18:00 Perú` del día y aplica la misma regla de mínimo 15.
- La app **no** debe depender de tener la página abierta para esto; ya corre en el servidor.

### 4.2 Teléfono
- Acepta **únicamente 9 dígitos** (sin letras ni caracteres especiales).
- Debe existir una **casilla** "no cuenta con teléfono". Al marcarla, el sistema guarda el literal **`NO TIENE`** y permite guardar aunque el campo esté vacío (el campo es obligatorio, pero la casilla lo satisface).
- Si **no** se marca la casilla y **no** se ingresó nada → **no se permite guardar**; mostrar al usuario qué dato falta.
- En BD `telefono` es `text` con CHECK: `^[0-9]{9}$` **o** `NO TIENE`.

### 4.3 DNI
- Obligatorio. Acepta **solo 8 dígitos** enteros.
- Si la persona no tiene DNI, sugerir (texto de ayuda) escribir los **8 dígitos de su fecha de nacimiento**, formato DDMMAAAA. Ejemplo: `25012006`.
- **Unicidad por CAD, no global:** restricción `UNIQUE (cad_id, dni)`. El mismo número puede existir en CADs distintos, pero no repetirse dentro del mismo CAD. En la práctica puede haber, en teoría, hasta 61 visitantes con el mismo número (uno por CAD).
- En BD `dni` es `text` con CHECK `^[0-9]{8}$` (texto para preservar ceros iniciales).

### 4.4 Visitante recurrente (reutilización de datos)
- Los datos de cada visitante se almacenan de forma permanente (tabla `visitantes`).
- Si el visitante vuelve, debe poder registrarse **solo con su DNI o nombre completo**: el sistema autocompleta todos los campos (nombre, apellido, edad, género, discapacidad, teléfono, ocupación, DNI).
- Flujo: elegir al visitante ya registrado → botón **"Registrar visita"** → crea un nuevo `registro` con la `hora_entrada` actual, sin re-teclear los datos.
- La búsqueda de recurrentes es **dentro del CAD del líder** (por la unicidad y RLS por CAD).
- **Edad al reutilizar:** se **precarga** la edad anterior y queda **editable**. Si el líder no la modifica, se registra con el valor anterior (no se recalcula; no se guarda fecha de nacimiento).

---

## 5. Esquema de base de datos (YA CREADO en Supabase)

Schema `public`. No recrear; usar tal cual. Resumen:

### Tablas
- **cads** (`id` bigint PK identity, `nombre` text unique, `creado_en`). 60 filas cargadas.
- **perfiles** (`id` uuid PK → auth.users, `rol` check in (superadmin,lider), `cad_id` → cads, `nombre`, `creado_en`). Superadmin ya insertado (UID `b1a8796a-e34a-4953-a70e-625f4f2d1ed9`).
- **ocupaciones** (`id` bigint PK identity, `nombre` text unique). Catálogo en MAYÚSCULAS, ~120 filas, incluye `OTRO`.
- **visitantes** (`id` bigint PK, `cad_id` → cads, `dni` text `^[0-9]{8}$`, `nombre`, `apellido`, `edad` int 0–120, `genero` in (Masculino,Femenino), `discapacidad` in (si,no), `telefono` text `^[0-9]{9}$` o `NO TIENE`, `ocupacion`, `creado_en`, **UNIQUE (cad_id, dni)**).
- **registros** (`id` bigint PK, `visitante_id` → visitantes, `cad_id` → cads, `lider_id` → auth.users, `fecha` date default hoy-Lima, `hora_entrada` timestamptz default now, `hora_salida` timestamptz, `minutos` int, `estado` in (en_curso,finalizado) default en_curso, `creado_en`). Índices en (cad_id, fecha) y (estado).

### Funciones (Postgres)
- `calcular_minutos(entrada timestamptz, salida timestamptz) → int` — `greatest(15, ceil(diff_min))`.
- `finalizar_registro(reg_id bigint)` — security definer; setea hora_salida=now(), minutos, estado=finalizado. **Ejecutable por `authenticated`.** Llamar vía RPC desde la app para finalizar.
- `autocierre_18()` — security definer; cierra todos los en_curso del día a las 18:00 Perú. **Solo para el cron** (revocado a anon/authenticated).
- `es_superadmin() → boolean` y `mi_cad() → bigint` — helpers para RLS.

### RLS (activado en todas las tablas)
- **cads:** todos los autenticados leen; solo superadmin escribe.
- **perfiles:** cada quien ve el suyo; superadmin ve/gestiona todos.
- **ocupaciones:** todos leen; solo superadmin modifica.
- **visitantes:** líder ve/gestiona los de su CAD; superadmin todo.
- **registros:** líder ve/crea los de su CAD; superadmin todo. No hay policy DELETE en RLS (el líder no borra). **El superadmin sí puede borrar** registros desde su vista, vía endpoint de servidor con `SUPABASE_SECRET_KEY` (service_role salta RLS); al borrar se conservan los `visitantes` (quedan como recurrentes). Update permitido para su CAD (se usa para finalizar).

### Cron
- Job `autocierre-cad-18h` (pg_cron) a las `0 23 * * *` UTC → `select public.autocierre_18();`.

---

## 6. Datos ya sembrados

- **CADs:** 60 nombres cargados (formato `4008_SM_RAFAEL BELAUNDE_CAD B`, etc.). El usuario esperaba 61; **falta confirmar/agregar 1** si corresponde. La app no debe asumir exactamente 61; leer dinámicamente de la tabla `cads`.
- **Ocupaciones:** ~120 en mayúsculas, incluye `OTRO`.
- **Superadmin:** creado en Auth e insertado en `perfiles` con rol superadmin, cad_id nulo.

---

## 7. Vistas a construir

> Antes de construir cualquiera de estas vistas, cargar y aplicar la skill `frontend-design` (ver §8). Móvil para el líder, escritorio para el superadmin.

### 7.1 Login (común)
- Correo + contraseña. Sesión persistente en el dispositivo.
- Tras autenticar, leer `perfiles.rol` y redirigir: `superadmin` → dashboard PC; `lider` → vista móvil.

### 7.2 Vista Líder digital (móvil, mínima)
- **Pantalla principal:** lista de registros **del día** (solo hoy, Lima) mostrando **DNI · Nombre completo · Estado** (En curso / Finalizado), con botón **"Finalizar"** en los que están en curso.
- **Registrar nuevo visitante:** formulario con todos los campos (§4). Validaciones: edad solo números; teléfono 9 dígitos o casilla "NO TIENE"; DNI 8 dígitos con texto de ayuda sobre fecha de nacimiento; género y discapacidad desplegables; cargo con buscador autocompletar sobre `ocupaciones`. Texto → MAYÚSCULAS al guardar. Crea visitante (si no existe en el CAD) + registro con hora_entrada.
- **Registrar visita de recurrente:** buscar por DNI o nombre dentro del CAD → autocompletar (edad editable) → "Registrar visita" → nuevo registro.
- **Finalizar:** llama `finalizar_registro` (RPC). No editar ni borrar nada más.
- La fecha NO la ingresa el usuario; la pone el sistema.

### 7.3 Vista Superadmin (escritorio)
- **Dashboard:** métricas/resumen de registros (totales, por CAD, por fecha, etc.).
- **Gestión de CADs:** ver/crear/editar los 61 nombres.
- **Gestión de líderes:** crear cuentas (correo) asociadas a un CAD, con contraseña por defecto `clave*2025`. (Crear usuarios en Auth requiere la clave secreta → endpoint de servidor.) Insertar su fila en `perfiles` con rol `lider` y su `cad_id`.
- **Registros:** ver todos; **filtrar por CAD y por rango de fechas (día/mes/año)**.
- **Exportar a .xlsx** con las columnas exactas del reporte (§4), en MAYÚSCULAS, fecha DD/MM/AAAA. Solo el superadmin exporta.

---

## 8. Convenciones y recordatorios

- **UTF-8** en toda la web.
- **MAYÚSCULAS** en todo el texto almacenado/mostrado/exportado. Convertir input del usuario automáticamente.
- **Zona horaria de operación:** America/Lima (UTC-5) para fechas, "hoy" y el corte de las 18:00.
- **Formato de fecha visible:** DD/MM/AAAA.
- **Nunca** exponer `SUPABASE_SECRET_KEY` al cliente; usarla solo en endpoints `+server.ts` / `+page.server.ts`.
- El **líder no** borra ni edita registros. El **superadmin sí** puede eliminar registros (individual o todos los del filtro) desde su vista; los `visitantes` se conservan como recurrentes. Se hace en endpoint de servidor con la clave secreta.
- Validaciones de formulario deben **bloquear el guardado** e **indicar el dato faltante** (especialmente teléfono y DNI).
- Mantener la vista del líder lo más ligera posible (mínimo JS, mínimo peso).
- **Diseño de interfaz:** para cualquier trabajo de UI (vistas, componentes, estilos), usar la skill `frontend-design` para lograr un diseño intencional y amigable que no se vea genérico (tipografía, jerarquía visual, espaciado). Priorizar la **usabilidad móvil del líder digital**: botones grandes y fáciles de tocar, alto contraste, mínimo desorden en pantalla, texto legible bajo luz solar y en pantallas pequeñas, y formularios que se llenan rápido con una sola mano. La vista del superadmin (PC) puede ser más densa (tablas, filtros, dashboard), pero igual clara y ordenada.

---

## 9. Estado actual del proyecto

- [x] Proyecto Supabase creado, pg_cron activado.
- [x] Esquema, funciones, RLS, cron aplicados.
- [x] 60 CADs y ~120 ocupaciones sembrados.
- [x] Superadmin creado.
- [x] Proyecto SvelteKit inicializado, dependencias instaladas, `.env` con las 3 variables.
- [ ] Cliente Supabase + auth con sesión persistente.
- [ ] Vista login con redirección por rol.
- [ ] Vista líder (móvil): lista del día, alta de visitante, recurrentes, finalizar.
- [ ] Vista superadmin (PC): dashboard, gestión CADs, gestión líderes, filtros, exportación xlsx.
- [ ] Adapter Vercel + variables de entorno en Vercel para desplegar.

Construir en ese orden salvo indicación distinta del usuario.
