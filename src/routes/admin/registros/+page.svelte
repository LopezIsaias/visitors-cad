<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let cad = $state(data.filtro.cad);
	let modo = $state<'dia' | 'mes' | 'anio'>(data.filtro.modo);
	let valor = $state(data.filtro.valor);

	let msg = $state<string | null>(null);
	let err = $state<string | null>(null);
	let delId = $state<string | null>(null);
	let delTodos = $state(false);

	function onResult(okMsg: string | ((d: any) => string)) {
		return () =>
			async ({ result, update }: { result: any; update: () => Promise<void> }) => {
				const d = result.data ?? {};
				if (result.type === 'success' && d.ok) {
					await invalidateAll();
					msg = typeof okMsg === 'function' ? okMsg(d) : okMsg;
					err = null;
					delId = null;
					delTodos = false;
				} else if (result.type === 'failure') {
					err = d.error ?? 'Error.';
				} else await update();
			};
	}

	// Mantener `valor` con el tipo de input correcto al cambiar de modo.
	function cambiarModo(m: 'dia' | 'mes' | 'anio') {
		modo = m;
		const hoy = new Date().toISOString().slice(0, 10);
		valor = m === 'dia' ? hoy : m === 'mes' ? hoy.slice(0, 7) : hoy.slice(0, 4);
	}

	function aplicar() {
		const p = new URLSearchParams({ cad, modo, valor });
		goto(`?${p.toString()}`, { keepFocus: true, noScroll: true });
	}

	const exportHref = $derived(
		`/admin/registros/export?${new URLSearchParams({
			cad: data.filtro.cad,
			modo: data.filtro.modo,
			valor: data.filtro.valor
		}).toString()}`
	);
</script>

<svelte:head><title>Registros — Admin</title></svelte:head>

<header class="head">
	<div><p class="eyebrow">REPORTES</p><h1>Registros</h1></div>
	<a class="export" href={exportHref} data-sveltekit-reload>⤓ Exportar .xlsx</a>
</header>

<section class="filtros">
	<label>
		<span>CAD</span>
		<select bind:value={cad}>
			<option value="all">Todos los CADs</option>
			{#each data.cads as c}<option value={String(c.id)}>{c.nombre}</option>{/each}
		</select>
	</label>

	<div class="modo">
		<span>Periodo</span>
		<div class="seg">
			<button class:on={modo === 'dia'} onclick={() => cambiarModo('dia')}>Día</button>
			<button class:on={modo === 'mes'} onclick={() => cambiarModo('mes')}>Mes</button>
			<button class:on={modo === 'anio'} onclick={() => cambiarModo('anio')}>Año</button>
		</div>
	</div>

	<label>
		<span>{modo === 'dia' ? 'Fecha' : modo === 'mes' ? 'Mes' : 'Año'}</span>
		{#if modo === 'dia'}
			<input type="date" bind:value={valor} />
		{:else if modo === 'mes'}
			<input type="month" bind:value={valor} />
		{:else}
			<input type="number" min="2024" max="2100" bind:value={valor} />
		{/if}
	</label>

	<button class="aplicar" onclick={aplicar}>Aplicar</button>
</section>

{#if msg}<p class="ok" role="status">{msg}</p>{/if}
{#if err}<p class="err" role="alert">{err}</p>{/if}

<div class="barra">
	<p class="conteo">{data.filas.length} registro(s)</p>
	{#if data.filas.length > 0}
		{#if delTodos}
			<form method="POST" action="?/eliminarFiltro" class="inline" use:enhance={onResult((d) => `${d.count} registro(s) eliminado(s). Los visitantes se conservan.`)}>
				<input type="hidden" name="cad" value={data.filtro.cad} />
				<input type="hidden" name="modo" value={data.filtro.modo} />
				<input type="hidden" name="valor" value={data.filtro.valor} />
				<span class="confirm">¿Eliminar los {data.filas.length} del filtro?</span>
				<button type="submit" class="mini danger">Sí, eliminar</button>
				<button type="button" class="mini" onclick={() => (delTodos = false)}>Cancelar</button>
			</form>
		{:else}
			<button type="button" class="mini ghost-danger" onclick={() => { delTodos = true; err = null; }}>
				Eliminar registros del filtro
			</button>
		{/if}
	{/if}
</div>

<div class="tablewrap">
	<table>
		<thead>
			<tr>
				<th>CAD</th><th>Fecha</th><th>Nombre Completo</th><th class="r">Edad</th>
				<th>Género</th><th>Discap.</th><th class="r">Min</th><th>Teléfono</th>
				<th>DNI</th><th>Cargo/Profesión</th><th class="acc">Acción</th>
			</tr>
		</thead>
		<tbody>
			{#if data.filas.length === 0}
				<tr><td colspan="11" class="vacio">Sin registros para este filtro.</td></tr>
			{:else}
				{#each data.filas as f (f.visitanteId + '|' + f.fechaIso)}
					{@const key = f.visitanteId + '|' + f.fechaIso}
					<tr>
						<td>{f.cad}</td><td class="nowrap">{f.fecha}</td><td>{f.nombreCompleto}</td>
						<td class="r">{f.edad ?? ''}</td><td>{f.genero}</td><td>{f.discapacidad}</td>
						<td class="r">{f.minutos ?? ''}</td><td class="mono">{f.telefono}</td>
						<td class="mono">{f.dni}</td><td>{f.ocupacion}</td>
						<td class="acc">
							{#if delId === key}
								<form method="POST" action="?/eliminar" class="inline" use:enhance={onResult('Registro eliminado.')}>
									<input type="hidden" name="visitante_id" value={f.visitanteId} />
									<input type="hidden" name="fecha" value={f.fechaIso} />
									<button type="submit" class="mini danger">Sí</button>
								</form>
								<button type="button" class="mini" onclick={() => (delId = null)}>No</button>
							{:else}
								<button type="button" class="mini ghost-danger" onclick={() => { delId = key; err = null; }}>Eliminar</button>
							{/if}
						</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>

<style>
	.head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 1.4rem; gap: 1rem; }
	.eyebrow { margin: 0; font-size: 0.66rem; letter-spacing: 0.18em; color: var(--river); font-weight: 700; }
	h1 { font-family: var(--display); margin: 0.15rem 0 0; font-size: 1.7rem; }
	.export { background: var(--sun); color: var(--ink); text-decoration: none; font-weight: 700; padding: 0.7rem 1.1rem; border-radius: 10px; white-space: nowrap; }
	.filtros { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.9rem; background: #fff; border: 1px solid var(--mist); border-radius: 14px; padding: 1.1rem; margin-bottom: 1.2rem; }
	.filtros label, .modo { display: flex; flex-direction: column; gap: 0.3rem; }
	.filtros span { font-size: 0.78rem; font-weight: 600; color: var(--muted); }
	select, input { padding: 0.6rem 0.75rem; border: 1.5px solid var(--mist); border-radius: 10px; }
	.seg { display: inline-flex; border: 1.5px solid var(--mist); border-radius: 10px; overflow: hidden; }
	.seg button { border: none; background: #fff; padding: 0.6rem 0.95rem; cursor: pointer; font-weight: 600; }
	.seg button + button { border-left: 1.5px solid var(--mist); }
	.seg button.on { background: var(--canopy); color: var(--paper); }
	.aplicar { background: var(--canopy); color: var(--paper); border: none; border-radius: 10px; padding: 0.65rem 1.3rem; font-weight: 700; cursor: pointer; }
	.ok { background: rgba(31,184,166,0.14); border-left: 3px solid var(--river); border-radius: 8px; padding: 0.65rem 0.85rem; margin: 0 0 0.8rem; }
	.err { background: rgba(192,57,43,0.08); border-left: 3px solid var(--danger); color: var(--danger); border-radius: 8px; padding: 0.65rem 0.85rem; margin: 0 0 0.8rem; }
	.barra { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin: 0 0 0.7rem; }
	.conteo { color: var(--muted); font-size: 0.85rem; margin: 0; }
	.inline { display: inline-flex; align-items: center; gap: 0.3rem; }
	.confirm { font-size: 0.82rem; color: var(--danger); margin-right: 0.2rem; }
	.acc { white-space: nowrap; text-align: right; }
	.mini { border: 1.5px solid var(--mist); background: #fff; border-radius: 8px; padding: 0.35rem 0.65rem; cursor: pointer; margin-left: 0.3rem; font-size: 0.8rem; }
	.mini.danger { background: var(--danger); color: var(--paper); border-color: var(--danger); }
	.mini.ghost-danger { color: var(--danger); border-color: rgba(192,57,43,0.4); }
	.tablewrap { border: 1px solid var(--mist); border-radius: 12px; overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
	th, td { padding: 0.55rem 0.8rem; text-align: left; border-bottom: 1px solid var(--mist); white-space: nowrap; }
	thead th { background: var(--paper); font-size: 0.72rem; text-transform: uppercase; color: var(--muted); position: sticky; top: 0; }
	tbody tr:last-child td { border-bottom: none; }
	.r { text-align: right; font-variant-numeric: tabular-nums; }
	.mono { font-family: ui-monospace, monospace; }
	.nowrap { white-space: nowrap; }
	.vacio { text-align: center; color: var(--muted); padding: 1.6rem; }
</style>
