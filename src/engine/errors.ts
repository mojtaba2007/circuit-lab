export type CircuitErrorCode = 'EMPTY' | 'NO_GROUND' | 'INVALID_VALUE' | 'INVALID_OPTIONS' | 'SINGULAR';

export class CircuitError extends Error {
  readonly code: CircuitErrorCode;
  constructor(code: CircuitErrorCode, message: string) {
    super(message);
    this.name = 'CircuitError';
    this.code = code;
  }
}
