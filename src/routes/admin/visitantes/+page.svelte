<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let cad = $state(data.cadId ? String(data.cadId) : '');
	let subiendo = $state(false);

	function cambiarCad() {
		goto(cad ? `?cad=${cad}` : '?', { noScroll: true });
	}

	const cadNombre = $derived(data.cads.find((c) => String(c.id) === String(data.cadId))?.nombre ?? '');
</script>

<svelte:head><title>Visitantes — Admin</title></svelte:head>

<header class="head">
	<div><p class="eyebrow">BASE DE DATOS</p><h1>Visitantes por CAD</h1></div>
</header>

<section class="panel">
	<label class="pick">
		<span>Abrir la base de datos del CAD</span>
		<select bind:value={cad} onchange={cambiarCad}>
			<option value="">Elige un CAD…</option>
			{#each data.cads as c}<option value={String(c.id)}>{c.nombre}</option>{/each}
		</select>
	</label>

	{#if data.cadId}
		<div class="carga">
			<p class="nota">
				Sube visitantes ya registrados (quedan como recurrentes para el líder). Formato:
				<a href="/admin/visitantes/plantilla" data-sveltekit-reload>⤓ Descargar plantilla .xlsx</a>
			</p>
			<form
				method="POST"
				action="?/subir"
				enctype="multipart/form-data"
				use:enhance={() => {
					subiendo = true;
					return async ({ update }) => {
						await update({ reset: false });
						await invalidateAll();
						subiendo = false;
					};
				}}
			>
				<input type="hidden" name="cad" value={data.cadId} />
				<div class="filea">
					<input type="file" name="archivo" accept=".xlsx,.xls,.csv" required />
					<button class="primary" type="submit" disabled={subiendo}>
						{subiendo ? 'Procesando…' : 'Subir al CAD'}
					</button>
				</div>
			</form>
		</div>
	{/if}
</section>

{#if form?.ok}
	<div class="resumen" role="status">
		<p><strong>{form.insertados}</strong> visitante(s) agregados ·
			<strong>{form.duplicadosBD}</strong> ya existían ·
			<strong>{form.conError}</strong> con error</p>
		{#if form.errores && form.errores.length > 0}
			<details>
				<summary>Ver filas con error ({form.conError})</summary>
				<ul>{#each form.errores as e}<li>{e}</li>{/each}</ul>
				{#if form.conError > form.errores.length}<p class="nota">…y más. Corrige y vuelve a subir.</p>{/if}
			</details>
		{/if}
	</div>
{:else if form?.error}
	<p class="err" role="alert">{form.error}</p>
{/if}

{#if data.cadId}
	<header class="subhead">
		<h2>{cadNombre} <span class="count">{data.visitantes.length}</span></h2>
	</header>
	<div class="tablewrap">
		<table>
			<thead><tr>
				<th>DNI</th><th>Nombre</th><th>Apellido</th><th class="r">Edad</th>
				<th>Género</th><th>Discap.</th><th>Teléfono</th><th>Ocupación</th>
			</tr></thead>
			<tbody>
				{#if data.visitantes.length === 0}
					<tr><td colspan="8" class="vacio">Este CAD aún no tiene visitantes. Sube un archivo para empezar.</td></tr>
				{:else}
					{#each data.visitantes as v (v.id)}
						<tr>
							<td class="mono">{v.dni}</td><td>{v.nombre}</td><td>{v.apellido}</td>
							<td class="r">{v.edad}</td><td>{v.genero}</td><td>{v.discapacidad}</td>
							<td class="mono">{v.telefono}</td><td>{v.ocupacion}</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.head { margin-bottom: 1.4rem; }
	.eyebrow { margin: 0; font-size: 0.66rem; letter-spacing: 0.18em; color: var(--river); font-weight: 700; }
	h1 { font-family: var(--display); margin: 0.15rem 0 0; font-size: 1.7rem; }
	.panel { background: #fff; border: 1px solid var(--mist); border-radius: 14px; padding: 1.2rem 1.3rem; margin-bottom: 1.4rem; max-width: 52rem; }
	.pick span { display: block; font-size: 0.8rem; font-weight: 600; color: var(--muted); margin-bottom: 0.35rem; }
	.pick select { width: 100%; padding: 0.7rem 0.85rem; border: 1.5px solid var(--mist); border-radius: 10px; }
	.carga { margin-top: 1.1rem; border-top: 1px solid var(--mist); padding-top: 1.1rem; }
	.nota { color: var(--muted); font-size: 0.85rem; margin: 0 0 0.8rem; }
	.nota a { color: var(--canopy); font-weight: 700; text-decoration: none; }
	.filea { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
	.filea input[type="file"] { flex: 1; min-width: 12rem; font-size: 0.88rem; }
	.primary { background: var(--canopy); color: var(--paper); border: none; border-radius: 10px; padding: 0.7rem 1.2rem; font-weight: 700; cursor: pointer; white-space: nowrap; }
	.primary:disabled { opacity: 0.6; cursor: progress; }
	.resumen { background: rgba(31,184,166,0.12); border-left: 3px solid var(--river); border-radius: 8px; padding: 0.8rem 1rem; margin-bottom: 1.2rem; }
	.resumen p { margin: 0; }
	.resumen details { margin-top: 0.5rem; }
	.resumen summary { cursor: pointer; font-weight: 600; color: var(--danger); }
	.resumen ul { margin: 0.5rem 0 0; padding-left: 1.2rem; font-size: 0.85rem; color: var(--danger); }
	.err { background: rgba(192,57,43,0.08); border-left: 3px solid var(--danger); color: var(--danger); border-radius: 8px; padding: 0.7rem 0.9rem; margin-bottom: 1.2rem; }
	.subhead { margin: 0 0 0.7rem; }
	.subhead h2 { font-family: var(--display); font-size: 1.2rem; display: flex; align-items: center; gap: 0.5rem; margin: 0; }
	.count { background: var(--canopy); color: var(--paper); font-size: 0.78rem; border-radius: 999px; padding: 0.1rem 0.6rem; }
	.tablewrap { border: 1px solid var(--mist); border-radius: 12px; overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
	th, td { padding: 0.55rem 0.8rem; text-align: left; border-bottom: 1px solid var(--mist); white-space: nowrap; }
	thead th { background: var(--paper); font-size: 0.72rem; text-transform: uppercase; color: var(--muted); }
	tbody tr:last-child td { border-bottom: none; }
	.r { text-align: right; font-variant-numeric: tabular-nums; }
	.mono { font-family: ui-monospace, monospace; }
	.vacio { text-align: center; color: var(--muted); padding: 1.6rem; white-space: normal; }
</style>
