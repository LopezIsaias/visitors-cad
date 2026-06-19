-- Una sola sesión activa por visitante por día (zona Lima, vía registros.fecha).
-- Impide doble registro simultáneo aunque el líder haga doble clic.
-- Pega y ejecuta en: Supabase Dashboard → SQL Editor.
--
-- El tope de 2 visitas/día se valida en la app; este índice garantiza
-- que nunca haya 2 visitas 'en_curso' del mismo visitante el mismo día.

create unique index if not exists uniq_visitante_sesion_activa
on public.registros (visitante_id, fecha)
where estado = 'en_curso';

-- Nota: si falla por datos duplicados existentes (ya hay 2 'en_curso' del
-- mismo visitante/día), avísame para limpiarlos antes de crear el índice.
