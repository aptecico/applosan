# Applosan

Aplicación móvil multi-tenant para almacenes de ropa. Fase 1: autenticación, usuarios, roles, permisos, sucursales y planes SaaS.

## Stack

- Expo SDK 57, React Native, TypeScript, Expo Router
- Backend: Postgres + Auth + RLS (hoy Supabase; el contrato SQL es portable a InsForge)

## Arranque local

1. Instala dependencias:

```bash
npm install
```

2. Copia variables de entorno:

```bash
copy .env.example .env
```

3. Levanta Supabase **local** (Docker requerido) o usa el proyecto en la nube (sección de abajo).

Local:

```bash
npx supabase start
npx supabase db reset
```

`db reset` aplica migrations, siembra el catálogo y usuarios de prueba, y corre `run_phase1_security_tests()`.

4. En `.env` usa la URL y la clave **anon** (`npx supabase status` en local, o Project Settings → API en la nube).

5. Arranca la app:

```bash
npx expo start --web
```

Nunca uses la clave `service_role` en la app móvil.

## Aplicar migrations en Supabase (nube)

Docker no es obligatorio. El SQL de Fase 1 está unificado en `supabase/apply_remote.sql`.

1. Abre el [SQL Editor del proyecto applosan](https://supabase.com/dashboard/project/qiikrptugpjktapcqqbk/sql/new).
2. Pega y ejecuta el contenido de `supabase/apply_remote.sql`.
3. Authentication → Providers: deja **Email** activo.
4. En `.env` usa Project URL + clave **anon/publishable** (`EXPO_PUBLIC_BACKEND_*` o el alias `EXPO_PUBLIC_SUPABASE_*`).

Para aplicar con CLI (hace falta `npx supabase login` en una terminal interactiva):

```bash
npx supabase link --project-ref qiikrptugpjktapcqqbk
npx supabase db push
```

## Fase 2 (bienvenida + lotes)

Después de Fase 1, aplica también `supabase/hotfix_phase2_welcome_lots.sql` en el SQL Editor (o `npx supabase db push` si el CLI está vinculado).

Eso:

- quita `dashboard.view` del rol Vendedor
- crea productos, proveedores, compras y `inventory_lots` (costos por adquisición / FIFO listo)

La app abre siempre en **Bienvenida** (no exige Dashboard).

`seed.sql` (usuarios de prueba) **no** va en la nube con `db push`; solo en `db reset` local.

## Fase 3–6 (operación)

Con el schema de Fase 2 aplicado, la app ya incluye pantallas reales de:

- Productos (alta/edición + categorías)
- Proveedores
- Compras (líneas con costo propio + recepción → lotes)
- Inventario (saldos y lotes FIFO)

Flujo típico: **Producto → Proveedor → Compra recibida → Inventario**.

## Compras (rediseño)

Tras Fase 2, aplica también `supabase/hotfix_phase3_purchases_audit.sql` para auditoría, anulación y edición segura de compras.

## Acoplamiento Supabase vs InsForge

El producto se diseña contra **Postgres + Auth JWT + RLS + RPC**, no contra un dashboard concreto. Porcentajes de lo que reutilizas si cambias de proveedor:

| Capa | Portable | Qué hay que tocar |
| --- | ---: | --- |
| Pantallas, navegación, tipos de negocio | **~95%** | Casi nada (importan `@/services/backend`) |
| Tablas, índices, catálogo, planes | **~85–90%** | SQL estándar |
| RLS y funciones `has_permission` / `register_tenant` | **~70%** | Revisar `auth.uid()` y grants (`authenticated` vs `project_admin`) |
| Trigger de perfil en `auth.users` | **~30%** | Metadata de signup (`raw_user_meta_data` vs `profile`) |
| Seed de usuarios de prueba | **~15%** | Inserta en `auth.users` (GoTrue) |
| SDK del cliente (`@supabase/supabase-js`) | **0% drop-in** | Se cambia solo el adaptador en `src/services/supabase` |

**Hoy, con el adaptador:** ~**80–85%** del sistema es independiente del proveedor. El **15–20%** restante es Auth SDK + hook de signup + seed.

**Sin adaptador** (features hablando directo con supabase-js): bajaría a ~**55–60%** atado a Supabase.

InsForge es Postgres + PostgREST + RLS con `auth.uid()` y `auth.users`, no un clon 1:1. Para migrar: mismo SQL de tablas/RPC, reescribir el trigger si el metadata cambia, y un `client.ts` con el SDK de InsForge. URL y clave siguen siendo `EXPO_PUBLIC_BACKEND_*`.

## Usuarios de prueba

Contraseña de todos: `Test1234!`

| Correo | Tenant | Rol |
| --- | --- | --- |
| `tenant-a-admin@applosan.test` | Almacén La Moda | Administrador |
| `tenant-a-seller@applosan.test` | Almacén La Moda | Vendedor |
| `tenant-b-admin@applosan.test` | Boutique Andrea | Administrador |

El vendedor no ve la pestaña Admin. El administrador de A no puede leer datos de Boutique Andrea.

## Auth en producción

En el dashboard de Supabase:

- Email/password activado
- Confirmación de correo recomendada en producción (`enable_confirmations`)
- Redirect URLs: `applosan://` y las URLs de Expo
- RLS ya aísla cada tenant; no confíes en filtros del cliente

## Estructura

La navegación vive en `src/app` (Expo Router). El dominio está en `src/features`. Las pantallas importan `@/services/backend`; el adaptador del proveedor está en `src/services/supabase`. Las variables `EXPO_PUBLIC_BACKEND_*` (o el alias `EXPO_PUBLIC_SUPABASE_*`) son URL y clave.
