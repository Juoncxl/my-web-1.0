/** Error raised by the direct Google API write paths; `code` mirrors the Apps Script apiFail_ codes. */
export class DirectWriteError extends Error {
  constructor(message: string, readonly code: string, readonly committed = false) { super(message); }
}

export const fail = (code: string, message: string): never => { throw new DirectWriteError(message, code); };
