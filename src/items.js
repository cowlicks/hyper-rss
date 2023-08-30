import Hyperbee from 'hyperbee';

export class Items {
  constructor({core, hyperbeeOptions}) {
    this.core = core;
    this.db = new Hyperbee(core, hyperbeeOptions);
  }
}

console.log(Hyperbee);
