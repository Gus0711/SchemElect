/** Historique annuler / rétablir par instantanés (le projet est un document JSON). */
export class History<T> {
	private undoStack: { label: string; state: T }[] = [];
	private redoStack: { label: string; state: T }[] = [];

	constructor(private limit = 200) {}

	/** Enregistre l'état AVANT une modification. */
	push(label: string, before: T) {
		this.undoStack.push({ label, state: before });
		if (this.undoStack.length > this.limit) this.undoStack.shift();
		this.redoStack = [];
	}

	undo(current: T): T | null {
		const entry = this.undoStack.pop();
		if (!entry) return null;
		this.redoStack.push({ label: entry.label, state: current });
		return entry.state;
	}

	redo(current: T): T | null {
		const entry = this.redoStack.pop();
		if (!entry) return null;
		this.undoStack.push({ label: entry.label, state: current });
		return entry.state;
	}

	get canUndo() {
		return this.undoStack.length > 0;
	}

	get canRedo() {
		return this.redoStack.length > 0;
	}

	get undoLabel() {
		return this.undoStack.at(-1)?.label;
	}

	get redoLabel() {
		return this.redoStack.at(-1)?.label;
	}

	clear() {
		this.undoStack = [];
		this.redoStack = [];
	}
}
