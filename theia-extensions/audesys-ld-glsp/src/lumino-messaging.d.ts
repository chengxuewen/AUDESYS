// Ambient type declarations for @lumino/messaging v2
// (package.json references types/index.d.ts but types are not bundled in the dist)
declare module '@lumino/messaging' {
  export class Message {
    constructor(type: string);
    type: string;
    isConflatable: boolean;
  }
}
