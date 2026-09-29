<script lang="ts" module>
	export type MenuEntry =
		| { separator: true }
		| {
				label: string;
				action: () => void;
				shortcut?: string;
				disabled?: boolean;
				danger?: boolean;
		  };
</script>

<script lang="ts">
	/** Menu contextuel générique, positionné au curseur et maintenu dans la fenêtre. */
	import { tick } from 'svelte';

	let { x, y, items, onclose }: { x: number; y: number; items: MenuEntry[]; onclose: () => void } =
		$props();

	let menu: HTMLDivElement | undefined = $state();
	let pos = $state({ left: 0, top: 0 });

	$effect(() => {
		pos = { left: x, top: y };
		tick().then(() => {
			if (!menu) return;
			const r = menu.getBoundingClientRect();
			pos = {
				left: Math.min(x, window.innerWidth - r.width - 4),
				top: Math.min(y, window.innerHeight - r.height - 4)
			};
			menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
		});
	});

	function run(entry: MenuEntry) {
		if ('separator' in entry || entry.disabled) return;
		onclose();
		entry.action();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			onclose();
			return;
		}
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
		e.preventDefault();
		const buttons = [...(menu?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
		const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const next = buttons[(i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length];
		next?.focus();
	}
</script>

<svelte:window
	onpointerdown={(e) => !menu?.contains(e.target as Node) && onclose()}
	onblur={onclose}
	onresize={onclose}
/>

<div
	class="menu"
	role="menu"
	tabindex="-1"
	bind:this={menu}
	style:left="{pos.left}px"
	style:top="{pos.top}px"
	{onkeydown}
	oncontextmenu={(e) => e.preventDefault()}
>
	{#each items as entry, i (i)}
		{#if 'separator' in entry}
			<hr />
		{:else}
			<button
				role="menuitem"
				class:danger={entry.danger}
				disabled={entry.disabled}
				onclick={() => run(entry)}
			>
				<span>{entry.label}</span>
				{#if entry.shortcut}<kbd>{entry.shortcut}</kbd>{/if}
			</button>
		{/if}
	{/each}
</div>

<style>
	.menu {
		position: fixed;
		z-index: 200;
		min-width: 220px;
		padding: var(--sp-1);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		outline: none;
	}
	button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-4);
		width: 100%;
		padding: 6px var(--sp-2);
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		font-size: var(--fs-md);
		text-align: left;
		cursor: pointer;
	}
	button:hover:not(:disabled),
	button:focus-visible {
		background: var(--c-primary-soft);
		outline: none;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.danger {
		color: var(--c-danger);
	}
	kbd {
		font-family: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
	hr {
		margin: var(--sp-1) 0;
		border: none;
		border-top: 1px solid var(--c-border);
	}
</style>
