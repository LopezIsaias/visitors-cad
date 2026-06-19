<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let msg = $state<string | null>(null);
	let err = $state<string | null>(null);
</script>

<svelte:head><title>Líderes — Admin</title></svelte:head>

<header class="head">
	<div><p class="eyebrow">GESTIÓN</p><h1>Líderes <span class="count">{data.lideres.length}</span></h1></div>
</header>

{#if msg}<p class="ok" role="status">{msg}</p>{/if}
{#if err}<p class="err" role="alert">{err}</p>{/if}

<section class="panel">
	<h2>Crear líder</h2>
	<p class="nota">Contraseña asignada automáticamente: <code>clave*2025</code> (igual para todos).</p>
	{#if data.cadsLibres.length === 0}
		<p class="nota">Todos los CADs ya tienen líder. Crea un CAD nuevo para asignar otro.</p>
	{:else}
		<form
			method="POST"
			action="?/crear"
			use:enhance={() => async ({ result, update }) => {
				const d = (result as any).data ?? {};
				if (result.type === 'success' && d.ok) {
					await invalidateAll();
					msg = `Líder creado: ${d.email}`;
					err = null;
				} else if (result.type === 'failure') {
					err = d.error ?? 'Error.';
				} else await update();
			}}
		>
			<div class="grid">
				<label><span>Nombre</span><input name="nombre" style="text-transform:uppercase" required /></label>
				<label><span>Correo</span><input name="email" type="email" autocapitalize="none" required /></label>
				<label>
					<span>CAD</span>
					<select name="cad_id" required>
						<option value="" disabled selected>Elige un CAD…</option>
						{#each data.cadsLibres as c}<option value={c.id}>{c.nombre}</option>{/each}
					</select>
				</label>
			</div>
			<button class="primary" type="submit">Crear cuenta de líder</button>
		</form>
	{/if}
</section>

<div class="tablewrap">
	<table>
		<thead><tr><th>Nombre</th><th>Correo</th><th>CAD</th></tr></thead>
		<tbody>
			{#if data.lideres.length === 0}
				<tr><td colspan="3" class="vacio">Aún no hay líderes.</td></tr>
			{:else}
				{#each data.lideres as l (l.id)}
					<tr><td>{l.nombre}</td><td class="mono">{l.email}</td><td>{l.cad}</td></tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>

<style>
	.head { margin-bottom: 1.4rem; }
	.eyebrow { margin: 0; font-size: 0.66rem; letter-spacing: 0.18em; color: var(--river); font-weight: 700; }
	h1 { font-family: var(--display); margin: 0.15rem 0 0; font-size: 1.7rem; display: flex; align-items: center; gap: 0.5rem; }
	.count { background: var(--canopy); color: var(--paper); font-size: 0.8rem; border-radius: 999px; padding: 0.1rem 0.6rem; }
	.ok { background: rgba(31,184,166,0.14); border-left: 3px solid var(--river); border-radius: 8px; padding: 0.65rem 0.85rem; margin: 0 0 1rem; }
	.err { background: rgba(192,57,43,0.08); border-left: 3px solid var(--danger); color: var(--danger); border-radius: 8px; padding: 0.65rem 0.85rem; margin: 0 0 1rem; }
	.panel { background: #fff; border: 1px solid var(--mist); border-radius: 14px; padding: 1.2rem 1.3rem; margin-bottom: 1.8rem; max-width: 52rem; }
	.panel h2 { font-family: var(--display); font-size: 1.1rem; margin: 0 0 0.3rem; }
	.nota { color: var(--muted); font-size: 0.85rem; margin: 0 0 1rem; }
	code { background: var(--paper); padding: 0.1rem 0.4rem; border-radius: 5px; }
	.grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.8rem; margin-bottom: 1rem; }
	label span { display: block; font-size: 0.8rem; font-weight: 600; color: var(--muted); margin-bottom: 0.3rem; }
	input, select { width: 100%; padding: 0.65rem 0.8rem; border: 1.5px solid var(--mist); border-radius: 10px; }
	.primary { background: var(--canopy); color: var(--paper); border: none; border-radius: 10px; padding: 0.75rem 1.3rem; font-weight: 700; cursor: pointer; }
	.tablewrap { border: 1px solid var(--mist); border-radius: 12px; overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
	th, td { padding: 0.6rem 0.9rem; text-align: left; border-bottom: 1px solid var(--mist); }
	thead th { background: var(--paper); font-size: 0.74rem; text-transform: uppercase; color: var(--muted); }
	tbody tr:last-child td { border-bottom: none; }
	.mono { font-family: ui-monospace, monospace; font-size: 0.85rem; }
	.vacio { color: var(--muted); text-align: center; padding: 1.4rem; }
	@media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
</style>
