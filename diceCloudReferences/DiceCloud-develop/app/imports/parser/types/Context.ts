
export default class Context {
  errors: { type: string; message: string }[];
  rolls: { number: number; diceSize: number; values: number[]; }[];
  options: { [key: string]: any; };

  constructor({ errors = [], rolls = [], options = {} } = {}) {
    this.errors = errors;
    this.rolls = rolls;
    this.options = options;
  }

  error(e: Error | string) {
    if (!e) return;
    if (typeof e === 'string') {
      this.errors.push({
        type: 'error',
        message: e,
      });
    } else {
      this.errors.push({
        type: 'error',
        message: e.message,
      });
    }
  }

  roll(r) {
    this.rolls.push(r);
  }
}
