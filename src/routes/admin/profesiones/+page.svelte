<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let editId = $state<number | null>(null);
	let delId = $state<number | null>(null);
	let q = $state('');
	let msg = $state<string | null>(null);
	let err = $state<string | null>(null);

	const filtradas = $derived(
		data.ocupaciones.filter((o) => o.nombre.includes(q.trim().toUpperCase()))
	);

	function submit(okMsg: string) {
		return () =>
			async ({ result, update }: { result: any; update: () => Promise<void> }) => {
				if (result.type === 'success' && result.data?.ok) {
					await invalidateAll();
					msg = okMsg;
					err = null;
					editId = null;
					delId = null;
				} else if (result.type === 'failure') {
					err = result.data?.error ?? 'Error.';
				} else await update();
			};
	}
</script>

<svelte:head><title>Profesiones — Admin</title></svelte:head>

<header class="head">
	<div><p class="eyebrow">CATÁLOGO</p><h1>Profesiones <span class="count">{data.ocupaciones.length}</span></h1></div>
</header>

{#if msg}<p class="ok" role="status">{msg}</p>{/if}
{#if err}<p class="err" role="alert">{err}</p>{/if}

<form class="nuevo" method="POST" action="?/crear" use:enhance={submit('Profesión creada.')}>
	<input name="nombre" class="up" placeholder="Nombre de la nueva profesión" required />
	<button type="submit">+ Crear profesión</button>
</form>

<div class="buscar">
	<input bind:value={q} class="up" placeholder="Buscar profesión…" />
	{#if q}<span class="hits">{filtradas.length} de {data.ocupaciones.length}</span>{/if}
</div>

<div class="tablewrap">
	<table>
		<thead><tr><th>Nombre</th><th class="acc">Acción</th></tr></thead>
		<tbody>
			{#if filtradas.length === 0}
				<tr><td colspan="2" class="vacio">Sin resultados.</td></tr>
			{:else}
				{#each filtradas as o (o.id)}
					<tr>
						<td>
							{#if editId === o.id}
								<form id="ed{o.id}" method="POST" action="?/editar" use:enhance={submit('Profesión actualizada.')}>
									<input type="hidden" name="id" value={o.id} />
									<input name="nombre" class="up" value={o.nombre} required />
								</form>
							{:else}
								{o.nombre}
							{/if}
						</td>
						<td class="acc">
							{#if editId === o.id}
								<button type="submit" form="ed{o.id}" class="mini primary">Guardar</button>
								<button type="button" class="mini" onclick={() => (editId = null)}>Cancelar</button>
							{:else if delId === o.id}
								<span class="confirm">¿Eliminar?</span>
								<form class="inline" method="POST" action="?/eliminar" use:enhance={submit('Profesión eliminada.')}>
									<input type="hidden" name="id" value={o.id} />
									<button type="submit" class="mini danger">Sí, eliminar</button>
								</form>
								<button type="button" class="mini" onclick={() => (delId = null)}>No</button>
							{:else}
								<button type="button" class="mini" onclick={() => { editId = o.id; delId = null; err = null; }}>Editar</button>
								<button type="button" class="mini ghost-danger" onclick={() => { delId = o.id; editId = null; err = null; }}>Eliminar</button>
							{/if}
						</td>
					</tr>
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
	.nuevo { display: flex; gap: 0.6rem; margin-bottom: 1rem; max-width: 40rem; }
	.nuevo input { flex: 1; padding: 0.7rem 0.85rem; border: 1.5px solid var(--mist); border-radius: 10px; }
	.nuevo button { background: var(--canopy); color: var(--paper); border: none; border-radius: 10px; padding: 0 1.1rem; font-weight: 700; cursor: pointer; white-space: nowrap; }
	.buscar { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem; max-width: 40rem; }
	.buscar input { flex: 1; padding: 0.6rem 0.85rem; border: 1.5px solid var(--mist); border-radius: 10px; }
	.hits { font-size: 0.8rem; color: var(--muted); white-space: nowrap; }
	.tablewrap { border: 1px solid var(--mist); border-radius: 12px; overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
	th, td { padding: 0.6rem 0.9rem; text-align: left; border-bottom: 1px solid var(--mist); }
	thead th { background: var(--paper); font-size: 0.74rem; text-transform: uppercase; color: var(--muted); }
	tbody tr:last-child td { border-bottom: none; }
	td input { width: 100%; padding: 0.45rem 0.6rem; border: 1.5px solid var(--river); border-radius: 8px; }
	.acc { white-space: nowrap; text-align: right; }
	.inline { display: inline; }
	.confirm { font-size: 0.82rem; color: var(--danger); margin-right: 0.3rem; }
	.mini { border: 1.5px solid var(--mist); background: #fff; border-radius: 8px; padding: 0.4rem 0.7rem; cursor: pointer; margin-left: 0.3rem; font-size: 0.82rem; }
	.mini.primary { background: var(--canopy); color: var(--paper); border-color: var(--canopy); }
	.mini.danger { background: var(--danger); color: var(--paper); border-color: var(--danger); }
	.mini.ghost-danger { color: var(--danger); border-color: rgba(192,57,43,0.4); }
	.vacio { color: var(--muted); text-align: center; padding: 1.4rem; }
	.up { text-transform: uppercase; }
</style>
