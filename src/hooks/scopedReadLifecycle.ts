export interface ScopedReadTicket {
  scopeKey: string;
  generation: number;
}

/** Invalidates stale reads on scope changes and deduplicates automatic bootstrap reads. */
export class ScopedReadLifecycle {
  private activeScopeKey: string | null = null;
  private generation = 0;
  private automaticLoadScopeKey: string | null = null;

  transition(scopeKey: string): boolean {
    if (this.activeScopeKey === scopeKey) return false;
    this.activeScopeKey = scopeKey;
    this.generation += 1;
    this.automaticLoadScopeKey = null;
    return true;
  }

  capture(scopeKey: string): ScopedReadTicket | null {
    return this.activeScopeKey === scopeKey ? { scopeKey, generation: this.generation } : null;
  }

  isCurrent(ticket: ScopedReadTicket): boolean {
    return this.activeScopeKey === ticket.scopeKey && this.generation === ticket.generation;
  }

  claimAutomaticLoad(scopeKey: string): boolean {
    if (this.activeScopeKey !== scopeKey || this.automaticLoadScopeKey === scopeKey) return false;
    this.automaticLoadScopeKey = scopeKey;
    return true;
  }
}
