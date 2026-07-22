/**
 * Type stubs for @lumino/messaging (JS-only package without bundled .d.ts).
 * Ponytail: minimal stubs for what LD GLSP actually uses.
 */

declare module '@lumino/messaging' {
    export class Message {
        constructor(type: string);
        readonly type: string;
        isConflatable: boolean;
    }

    export class ConflatableMessage extends Message {
        constructor(type: string);
    }

    export interface IMessageHandler {
        processMessage(msg: Message): void;
    }

    export interface IMessageHook {
        messageHook(handler: IMessageHandler, msg: Message): boolean;
    }

    export module MessageLoop {
        function sendMessage(target: IMessageHandler, msg: Message): void;
        function postMessage(target: IMessageHandler, msg: Message): void;
        function flush(): void;
    }
}
