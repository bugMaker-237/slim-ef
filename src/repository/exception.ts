export class EmptySetException extends Error {
  constructor(message?: string) {
    super(message || 'Object not found');
  }
}
