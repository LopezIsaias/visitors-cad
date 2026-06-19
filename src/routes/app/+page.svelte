<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// "YYYY-MM-DD" → "DD/MM/AAAA"
	const fechaTxt = $derived(data.hoy.split('-').reverse().join('/'));

	type Sheet = null | 'nuevo' | 'recurrente';
	let sheet = $state<Sheet>(null);
	let mensaje = $state<string | null>(null);
	let error = $state<string | null>(null);

	// --- Nuevo visitante ---
	let sinTelefono = $state(false);

	// --- Recurrente ---
	type Visitante = {
		id: number;
		dni: string;
		nombre: string;
		apellido: string;
		edad: number;
		genero: string;
		discapacidad: string;
		telefono: string;
		ocupacion: string;
	};
	let term = $state('');
	let resultados = $state<Visitante[]>([]);
	let elegido = $state<Visitante | null>(null);
	let edadVisita = $state<number | ''>('');
	let buscando = $state(false);
	let timer: ReturnType<typeof setTimeout>;

	function buscar() {
		clearTimeout(timer);
		elegido = null;
		const q = term.trim();
		if (q.length < 2) {
			resultados = [];
			return;
		}
		timer = setTimeout(async () => {
			buscando = true;
			const sb = $page.data.supabase; // RLS limita al CAD del líder
			const isDni = /^[0-9]+$/.test(q);
			let query = sb
				.from('visitantes')
				.select('id, dni, nombre, apellido, edad, genero, discapacidad, telefono, ocupacion');
			query = isDni
				? query.ilike('dni', `${q}%`)
				: query.or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%`);
			const { data: res } = await query.limit(8);
			resultados = res ?? [];
			buscando = false;
		}, 250);
	}

	function elegir(v: Visitante) {
		elegido = v;
		edadVisita = v.edad;
		resultados = [];
		term = `${v.dni} · ${v.nombre} ${v.apellido}`;
	}

	function abrir(s: Sheet) {
		sheet = s;
		mensaje = null;
		error = null;
		sinTelefono = false;
		term = '';
		resultados = [];
		elegido = null;
	}

	function cerrar() {
		sheet = null;
	}

	// enhance compartido: refresca lista, cierra hoja, muestra mensaje
	function handle(okMsg: string) {
		return () =>
			async ({ result, update }: { result: any; update: () => Promise<void> }) => {
				if (result.type === 'success' && result.data?.ok) {
					await invalidateAll();
					sheet = null;
					mensaje = okMsg;
					error = null;
				} else if (result.type === 'failure') {
					error = result.data?.error ?? 'No se pudo guardar.';
				} else {
					await update();
				}
			};
	}
</script>

<svelte:head>
	<title>Mi CAD — Visitantes de hoy</title>
	<meta name="theme-color" content="#07211d" />
</svelte:head>

<header class="top">
	<div>
		<p class="eyebrow">REGIÓN SAN MARTÍN · {fechaTxt}</p>
		<h1>{data.cadNombre ?? 'Mi CAD'}</h1>
		<p class="lider">Líder: {data.nombre ?? '—'}</p>
	</div>
	<form method="POST" action="?/logout" use:enhance>
		<button class="ghost" type="submit" aria-label="Cerrar sesión">Salir</button>
	</form>
</header>

<main class="wrap">
	{#if mensaje}
		<p class="ok" role="status">{mensaje}</p>
	{/if}

	<div class="acciones">
		<button class="primary" onclick={() => abrir('nuevo')}>+ Nuevo visitante</button>
		<button class="secondary" onclick={() => abrir('recurrente')}>Recurrente</button>
	</div>

	<section aria-labelledby="hoyTit">
		<h2 id="hoyTit" class="seccion">Visitantes de hoy <span class="conteo">{data.registros.length}</span></h2>

		{#if data.registros.length === 0}
			<p class="vacio">Aún no hay registros hoy. Usa "+ Nuevo visitante" para empezar.</p>
		{:else}
			<ul class="lista">
				{#each data.registros as r (r.id)}
					<li class="reg">
						<div class="reg__info">
							<span class="dni">{r.dni}</span>
							<span class="nom">{r.nombre} {r.apellido}</span>
						</div>
						{#if r.estado === 'en_curso'}
							<form method="POST" action="?/finalizar" use:enhance={handle('Visita finalizada.')}>
								<input type="hidden" name="reg_id" value={r.id} />
								<button class="fin" type="submit">Finalizar</button>
							</form>
						{:else}
							<span class="badge">Finalizado · {r.minutos} min</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>

{#if sheet}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="overlay" onclick={cerrar}></div>
	<div class="hoja" role="dialog" aria-modal="true">
		<div class="hoja__bar">
			<h2>{sheet === 'nuevo' ? 'Nuevo visitante' : 'Registrar recurrente'}</h2>
			<button class="x" onclick={cerrar} aria-label="Cerrar">✕</button>
		</div>

		{#if error}<p class="err" role="alert">{error}</p>{/if}

		{#if sheet === 'nuevo'}
			<form method="POST" action="?/nuevo" use:enhance={handle('Visitante registrado. Entrada guardada.')}>
				<label class="f">
					<span>DNI</span>
					<input name="dni" inputmode="numeric" maxlength="8" pattern="[0-9]{'{8}'}" required placeholder="8 dígitos" />
					<small>Sin DNI: usa tu fecha de nacimiento DDMMAAAA (ej. 25012006).</small>
				</label>
				<div class="row">
					<label class="f"><span>Nombre</span><input name="nombre" class="up" required /></label>
					<label class="f"><span>Apellido</span><input name="apellido" class="up" required /></label>
				</div>
				<div class="row">
					<label class="f"><span>Edad</span><input name="edad" type="number" inputmode="numeric" min="0" max="120" required /></label>
					<label class="f">
						<span>Género</span>
						<select name="genero" required>
							<option value="" disabled selected>Elige…</option>
							<option value="MASCULINO">Masculino</option>
							<option value="FEMENINO">Femenino</option>
						</select>
					</label>
				</div>
				<label class="f">
					<span>¿Cuenta con alguna discapacidad?</span>
					<select name="discapacidad" required>
						<option value="" disabled selected>Elige…</option>
						<option value="NO">No</option>
						<option value="SI">Sí</option>
					</select>
				</label>
				<label class="f">
					<span>Teléfono</span>
					<input name="telefono" inputmode="numeric" maxlength="9" pattern="[0-9]{'{9}'}" disabled={sinTelefono} placeholder="9 dígitos" />
				</label>
				<label class="check">
					<input type="checkbox" name="sin_telefono" bind:checked={sinTelefono} />
					No cuenta con teléfono
				</label>
				<label class="f">
					<span>Cargo / Profesión</span>
					<input name="ocupacion" class="up" list="ocupaciones" required placeholder="Escribe para buscar…" />
				</label>
				<button class="primary full" type="submit">Guardar y registrar entrada</button>
			</form>
		{:else}
			<div class="f">
				<span class="lbl">Buscar por DNI o nombre</span>
				<input bind:value={term} oninput={buscar} class="up" placeholder="DNI o nombre…" autocomplete="off" />
			</div>
			{#if buscando}<p class="hint">Buscando…</p>{/if}
			{#if resultados.length > 0}
				<ul class="res">
					{#each resultados as v (v.id)}
						<li><button type="button" onclick={() => elegir(v)}><strong>{v.dni}</strong> · {v.nombre} {v.apellido}</button></li>
					{/each}
				</ul>
			{:else if term.trim().length >= 2 && !buscando && !elegido}
				<p class="hint">Sin coincidencias en este CAD.</p>
			{/if}

			{#if elegido}
				<form method="POST" action="?/visita" use:enhance={handle('Visita registrada.')}>
					<input type="hidden" name="visitante_id" value={elegido.id} />
					<div class="ficha">
						<p><strong>{elegido.nombre} {elegido.apellido}</strong></p>
						<p>{elegido.genero} · {elegido.ocupacion} · Tel: {elegido.telefono}</p>
					</div>
					<label class="f">
						<span>Edad (editable)</span>
						<input name="edad" type="number" inputmode="numeric" min="0" max="120" bind:value={edadVisita} required />
					</label>
					<button class="primary full" type="submit">Registrar visita</button>
				</form>
			{/if}
		{/if}
	</div>
{/if}

<datalist id="ocupaciones">
	{#each data.ocupaciones as o}<option value={o}></option>{/each}
</datalist>

<style>
	.top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.1rem 1.1rem 0.9rem;
		background: linear-gradient(180deg, var(--ink), var(--canopy));
		color: var(--paper);
	}
	.eyebrow {
		margin: 0;
		font-size: 0.66rem;
		letter-spacing: 0.16em;
		color: var(--river);
		font-weight: 600;
	}
	.top h1 {
		font-family: var(--display);
		font-size: 1.15rem;
		margin: 0.2rem 0 0;
		line-height: 1.15;
	}
	.lider {
		margin: 0.2rem 0 0;
		font-size: 0.8rem;
		opacity: 0.8;
	}
	.ghost {
		background: rgba(255, 255, 255, 0.12);
		color: var(--paper);
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 10px;
		padding: 0.5rem 0.8rem;
		cursor: pointer;
	}

	.wrap {
		max-width: 34rem;
		margin: 0 auto;
		padding: 1rem 1.1rem 4rem;
	}

	.ok {
		background: rgba(31, 184, 166, 0.14);
		border-left: 3px solid var(--river);
		border-radius: 8px;
		padding: 0.7rem 0.85rem;
		margin: 0 0 1rem;
		font-size: 0.9rem;
	}

	.acciones {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 0.6rem;
		margin: 0.4rem 0 1.4rem;
	}
	.primary {
		background: var(--canopy);
		color: var(--paper);
		border: none;
		border-radius: 12px;
		padding: 0.95rem 1rem;
		font-family: var(--display);
		font-weight: 700;
		font-size: 1rem;
		cursor: pointer;
	}
	.secondary {
		background: #fff;
		color: var(--canopy);
		border: 1.5px solid var(--canopy);
		border-radius: 12px;
		padding: 0.95rem 0.6rem;
		font-weight: 700;
		cursor: pointer;
	}
	.full {
		width: 100%;
		margin-top: 0.5rem;
	}

	.seccion {
		font-family: var(--display);
		font-size: 1rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.8rem;
	}
	.conteo {
		background: var(--canopy);
		color: var(--paper);
		font-size: 0.78rem;
		border-radius: 999px;
		padding: 0.05rem 0.55rem;
	}
	.vacio {
		color: var(--muted);
		background: var(--paper);
		border: 1px dashed var(--mist);
		border-radius: 12px;
		padding: 1.1rem;
		font-size: 0.92rem;
	}

	.lista {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.reg {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		background: var(--paper);
		border: 1px solid var(--mist);
		border-radius: 12px;
		padding: 0.75rem 0.9rem;
	}
	.reg__info {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.dni {
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		font-size: 0.95rem;
	}
	.nom {
		color: var(--muted);
		font-size: 0.85rem;
		text-transform: uppercase;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.fin {
		background: var(--sun);
		color: var(--ink);
		border: none;
		border-radius: 10px;
		padding: 0.55rem 0.9rem;
		font-weight: 700;
		cursor: pointer;
		white-space: nowrap;
	}
	.badge {
		font-size: 0.78rem;
		color: var(--canopy);
		font-weight: 600;
		white-space: nowrap;
	}

	/* Hoja inferior (sheet) */
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(7, 33, 29, 0.5);
		z-index: 10;
	}
	.hoja {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 11;
		background: #fff;
		border-radius: 18px 18px 0 0;
		padding: 1rem 1.1rem 1.6rem;
		max-height: 92vh;
		overflow-y: auto;
		max-width: 34rem;
		margin: 0 auto;
		box-shadow: 0 -20px 50px -20px rgba(7, 33, 29, 0.5);
	}
	.hoja__bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.6rem;
	}
	.hoja__bar h2 {
		font-family: var(--display);
		font-size: 1.1rem;
		margin: 0;
	}
	.x {
		border: none;
		background: var(--paper);
		border-radius: 8px;
		width: 2rem;
		height: 2rem;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.f {
		display: block;
		margin-bottom: 0.85rem;
	}
	.f > span,
	.lbl {
		display: block;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--muted);
		margin-bottom: 0.35rem;
	}
	.f input,
	.f select {
		width: 100%;
		padding: 0.8rem 0.85rem;
		border: 1.5px solid var(--mist);
		border-radius: 10px;
		background: #fff;
	}
	.f input:disabled {
		background: var(--paper);
		color: var(--muted);
	}
	.up {
		text-transform: uppercase;
	}
	.f small {
		display: block;
		margin-top: 0.3rem;
		color: var(--muted);
		font-size: 0.74rem;
		text-transform: none;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		margin: -0.3rem 0 1rem;
	}

	.err {
		background: rgba(192, 57, 43, 0.08);
		border-left: 3px solid var(--danger);
		border-radius: 8px;
		padding: 0.65rem 0.8rem;
		margin: 0 0 0.9rem;
		color: var(--danger);
		font-size: 0.85rem;
	}
	.hint {
		color: var(--muted);
		font-size: 0.85rem;
		margin: 0.2rem 0 0.6rem;
	}
	.res {
		list-style: none;
		margin: 0 0 0.8rem;
		padding: 0;
		border: 1px solid var(--mist);
		border-radius: 10px;
		overflow: hidden;
	}
	.res li + li {
		border-top: 1px solid var(--mist);
	}
	.res button {
		width: 100%;
		text-align: left;
		background: #fff;
		border: none;
		padding: 0.75rem 0.85rem;
		cursor: pointer;
		font-size: 0.9rem;
	}
	.res button:hover {
		background: var(--paper);
	}
	.ficha {
		background: var(--paper);
		border-radius: 10px;
		padding: 0.7rem 0.85rem;
		margin-bottom: 0.85rem;
		font-size: 0.88rem;
	}
	.ficha p {
		margin: 0.1rem 0;
	}
</style>
