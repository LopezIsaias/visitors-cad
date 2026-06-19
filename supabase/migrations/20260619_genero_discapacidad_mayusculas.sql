-- Migración: género y discapacidad en MAYÚSCULAS a nivel de BD.
-- Borra todos los datos (registros + visitantes) para empezar desde cero.
-- Pega y ejecuta en: Supabase Dashboard → SQL Editor.

-- 1. Borrar datos y reiniciar los IDs (cero histórico).
truncate table public.registros, public.visitantes restart identity cascade;

-- 2. Quitar los CHECK viejos de genero/discapacidad en visitantes
--    (sin asumir el nombre del constraint).
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.visitantes'::regclass
      and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%genero%'
           or pg_get_constraintdef(oid) ilike '%discapacidad%')
  loop
    execute format('alter table public.visitantes drop constraint %I', c.conname);
  end loop;
end$$;

-- 3. Nuevos CHECK en MAYÚSCULAS.
alter table public.visitantes
  add constraint visitantes_genero_check
    check (genero in ('MASCULINO', 'FEMENINO')),
  add constraint visitantes_discapacidad_check
    check (discapacidad in ('SI', 'NO'));

-- Verificación rápida (opcional):
-- select conname, pg_get_constraintdef(oid)
-- from pg_constraint
-- where conrelid = 'public.visitantes'::regclass and contype = 'c';
