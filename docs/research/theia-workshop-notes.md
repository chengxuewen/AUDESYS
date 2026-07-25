# AUDESYS Theia Learning Workshop Notes

> **Generated:** 2026-07-21 | **Purpose:** Research + documentation — NOT production implementation
>
> Covers: inversify DI, Contribution System, GLSP Architecture, Monarch Tokenizer, Gotchas

---

## 1. inversify Dependency Injection (DI) Patterns

### 1.1 Core Concepts

Theia uses **InversifyJS** as its IoC container. Every Theia extension registers services and
contributions through `ContainerModule`s. Understanding Inversify is critical because Theia's
entire architecture is built on it.

| Concept | Inversify | Theia Usage |
|---------|-----------|-------------|
| Container | `Container` | Global frontend/backend DI container |
| Module | `ContainerModule` | Each extension exports one or more |
| Binding | `bind(Symbol).to(Class)` | Registers an implementation |
| Injection | `@inject(Symbol)` | Requests a dependency |
| Scope | `inSingletonScope()` | Default binding is **transient** (!) |
| Decorator | `@injectable()` | Marks a class for DI construction |

### 1.2 ContainerModule — The Entry Point

Every Theia extension defines at least one `ContainerModule`:

```typescript
// theia-extensions/workshop-playground/src/browser/workshop-playground-frontend-module.ts

import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution, MenuContribution } from '@theia/core';

export default new ContainerModule((bind) => {
    // bind(INTERFACE_SYMBOL).to(ImplementationClass)
    bind(CommandContribution).to(WorkshopPlaygroundCommandContribution);
    bind(MenuContribution).to(WorkshopPlaygroundCommandContribution);
    // ^ Same class implements both interfaces — DRY pattern
});
```

**Key rules:**
- `ContainerModule` receives a `bind` function as parameter
- The module is **exported as default** from the entry point
- Listed in `package.json` under `theiaExtensions[].frontend` or `backend`
- Theia merges ALL modules into one global container at startup

### 1.3 bind/unbind — Registration

```typescript
// --- Singleton binding ---
bind(MyService).to(MyServiceImpl).inSingletonScope();
// Same instance returned every time @inject(MyService) is requested

// --- Transient binding (DEFAULT) ---
bind(MyService).to(MyServiceImpl);
// NEW instance created for every injection request

// --- Constant binding ---
bind(MyService).toConstantValue(new MyServiceImpl());

// --- Factory binding ---
bind<interfaces.Factory<MyWidget>>(MyWidgetFactory).toFactory<MyWidget>(
    (context: interfaces.Context) =>
        (options: MyWidgetOptions) =>
            new MyWidget(options)
);

// --- Dynamic binding (conditional) ---
bind(MyService).to(MyServiceImpl).whenTargetNamed('production');
bind(MyService).to(MyMockImpl).whenTargetNamed('test');

// --- Rebinding (override existing) ---
container.rebind(MyService).to(MyNewImpl);
// ⚠️ Use sparingly — order-dependent
```

### 1.4 @injectable() Decorator

```typescript
import { injectable, inject } from '@theia/core/shared/inversify';

@injectable()
export class WorkshopPlaygroundCommandContribution
    implements CommandContribution, MenuContribution
{
    // Constructor injection — preferred pattern
    constructor(
        @inject(MessageService) private readonly messageService: MessageService,
    ) {}

    registerCommands(registry: CommandRegistry): void { /* ... */ }
    registerMenus(menus: MenuModelRegistry): void { /* ... */ }
}
```

**⚠️ CRITICAL:** `@injectable()` MUST be on every class that is created by the DI container.
If you forget it, Inversify throws a runtime error about missing metadata.

### 1.5 @inject vs @multiInject

```typescript
// Single dependency
@inject(MessageService) private readonly msg: MessageService;

// Multiple implementations (contribution providers)
@inject(ContributionProvider) @named(OpenHandler)
private readonly openHandlers: ContributionProvider<OpenHandler>;
```

### 1.6 @postConstruct() — Initialization After Injection

```typescript
@injectable()
export class MyComponent {
    @inject(Logger) private readonly logger: Logger;

    private isReady = false;

    @postConstruct()
    protected init(): void {
        // Called AFTER constructor and ALL field injections complete
        this.isReady = true;
        this.logger.info('MyComponent initialized');
    }
}
```

---

## 2. Contribution System

Theia's extension model uses **Contribution Points** — interfaces that extensions implement to
add functionality. The Theia platform then collects all implementations via multi-injection.

### 2.1 CommandContribution

Registers executable commands.

```typescript
import { Command, CommandContribution, CommandRegistry } from '@theia/core';
import { injectable } from '@theia/core/shared/inversify';

// Step 1: Define the command descriptor
const MyCommand: Command = {
    id: 'my.extension.command',
    label: 'My Command Name',     // shown in command palette
    category: 'My Extension',      // grouping (optional)
};

// Step 2: Implement CommandContribution
@injectable()
export class MyCommandContribution implements CommandContribution {
    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(MyCommand, {
            execute: () => console.log('Command executed!'),
            // Optional context-sensitivity:
            isEnabled: () => true,      // can the command run right now?
            isVisible: () => true,      // show in palette/menus?
            isToggle: () => false,      // checkmark for toggle commands?
        });
    }
}

// Step 3: Bind in ContainerModule
// bind(CommandContribution).to(MyCommandContribution);
```

### 2.2 MenuContribution

Adds items to existing menus (File, Edit, Help, etc.).

```typescript
import { MenuContribution, MenuModelRegistry } from '@theia/core';
import { CommonMenus } from '@theia/core/lib/browser';
import { injectable } from '@theia/core/shared/inversify';

@injectable()
export class MyMenuContribution implements MenuContribution {
    registerMenus(menus: MenuModelRegistry): void {
        // Add to an existing menu group
        menus.registerMenuAction(CommonMenus.HELP, {
            commandId: 'my.extension.command',
            label: 'About My Extension',
            order: 'a',        // sort order within menu group
        });

        // CommonMenus provides these paths:
        // CommonMenus.FILE, EDIT, VIEW, HELP
        // CommonMenus.EDIT_FIND, EDIT_CLIPBOARD
    }
}
```

### 2.3 WidgetFactory

Creates custom widgets (panels, editors, views).

```typescript
import { WidgetFactory, WidgetManager } from '@theia/core/lib/browser';
import { injectable } from '@theia/core/shared/inversify';

@injectable()
export class MyWidgetFactory implements WidgetFactory {
    readonly id = 'my-widget-factory';

    createWidget(): Widget {
        const widget = new BaseWidget();
        widget.id = 'my-widget';
        widget.title.label = 'My Widget';
        widget.title.closable = true;
        return widget;
    }
}

// Binding:
// bind(WidgetFactory).to(MyWidgetFactory);
```

### 2.4 ViewContribution

Adds a view container (sidebar panel like Navigator, Debug, etc.).

```typescript
import { AbstractViewContribution } from '@theia/core/lib/browser';
import { injectable } from '@theia/core/shared/inversify';

@injectable()
export class MyViewContribution extends AbstractViewContribution<MyWidget> {
    constructor() {
        super({
            widgetId: 'my-widget',
            widgetName: 'My View',
            defaultWidgetOptions: {
                area: 'left',      // 'left' | 'right' | 'bottom'
                rank: 500,         // sort order in sidebar
            },
        });
    }
}
```

### 2.5 ToolbarContribution

Adds buttons to the toolbar.

```typescript
import { ToolbarContribution, ToolbarRegistry } from '@theia/core/lib/browser';

@injectable()
export class MyToolbarContribution implements ToolbarContribution {
    registerToolbarItems(registry: ToolbarRegistry): void {
        registry.registerItem({
            id: 'my.toolbar.button',
            command: 'my.extension.command',
            tooltip: 'Do something',
            priority: 10,
        });
    }
}
```

### 2.6 Binding Pattern Summary

```typescript
// All bindings go in the ContainerModule:
export default new ContainerModule((bind) => {
    bind(CommandContribution).to(MyCommandContribution);
    bind(MenuContribution).to(MyMenuContribution);
    bind(WidgetFactory).to(MyWidgetFactory);
    bind(FrontendApplicationContribution).to(MyFrontendContribution);
    // ...etc
});
```

---

## 3. GLSP Architecture

### 3.1 Overview

GLSP (Graphical Language Server Platform) applies the LSP pattern to diagram editors.
Client (rendering) and Server (model logic) communicate via JSON-RPC protocol.

```
┌──────────────┐         JSON-RPC         ┌──────────────┐
│  GLSP Client  │ ◄───── WebSocket ──────► │  GLSP Server  │
│  (Sprotty)    │                          │  (Java or Node)│
├──────────────┤                          ├──────────────┤
│ Diagram View  │  ActionMessage flow:     │ GModel (graph)│
│ SVG rendering │  Client → ActionMessage  │ ActionHandler  │
│ Editing tools │  Server → ActionMessage  │ ModelState     │
└──────────────┘                          └──────────────┘
```

### 3.2 Core Concepts

| Component | Role |
|-----------|------|
| **GModel** | The graphical model — JSON graph of nodes, edges, labels, compartments |
| **GModelRoot** | Top-level container (diagram canvas) |
| **GModelState** | Server-side state holding the current model |
| **ActionMessage** | JSON-RPC message type between client and server |
| **ActionHandler** | Server-side handler for specific action types |
| **ActionDispatcher** | Routes actions to handlers and dispatches results |
| **ModelSubmissionHandler** | Serializes GModel → SetModelAction / UpdateModelAction |

### 3.3 GModel Element Types

```typescript
// Core GModel node types (from @eclipse-glsp/client):
GNode       // A node (rectangle, circle, custom shape) in the diagram
GEdge       // A connection between two GNodes
GLabel      // Text label, inside or near a node/edge
GCompartment // A container inside a node (like a box of pins)
GPort       // A connection point on a node for edges
```

### 3.4 ActionMessage Lifecycle

```
1. Initial Load:
   Client → RequestModelAction ───► Server
   Client ◄─── SetModelAction (full GModel)

2. Edit Operation:
   Client → CreateNodeOperation ──► Server
   Server processes, updates GModelState
   Client ◄─── UpdateModelAction (patch)

3. Layout:
   Client → RequestBoundsAction ───► Server
   Server auto-layouts (optional ELK integration)
   Client ◄─── ComputedBoundsAction

4. Validation:
   Server → RequestMarkersAction ──► Server (internal)
   Client ◄─── SetMarkersAction (errors/warnings)
```

### 3.5 GLSP Server Handler Pattern (Node.js)

```typescript
// Simplified GLSP server handler pattern
@injectable()
export class MyCreateNodeHandler implements ActionHandler {
    // The action KIND this handler responds to
    readonly actionKinds = [CreateNodeOperation.KIND];

    @inject(GModelState) protected modelState: GModelState;
    @inject(ModelSubmissionHandler) protected submissionHandler: ModelSubmissionHandler;

    execute(operation: CreateNodeOperation): MaybePromise<Action[]> {
        const node = GNode.builder()
            .id(this.modelState.nextId())
            .type('my-node-type')
            .position(operation.location.x, operation.location.y)
            .size(100, 60)
            .build();

        this.modelState.root.add(node);

        // Submit updated model to client
        return this.submissionHandler.submitModel('Node created');
    }
}
```

### 3.6 Key Takeaways for AUDESYS

1. **GLSP Server = diagram logic.** AUDESYS needs a server-side ActionHandler for each IEC 61131-3 editor operation (add contact in LD, add block in FBD, add step in SFC).
2. **GModel = intermediate representation.** Not the source code — just visualization data. The semantic model (IEC program AST) lives separately.
3. **Synchronization is complex.** Changes in the diagram must reflect in the semantic model and vice versa. This is the hardest part.
4. **ELK Layout.** The Eclipse Layout Kernel can auto-layout diagrams. Useful for auto-arranging FBD blocks.
5. **Neuron Automation** uses GLSP for IEC 61131-3 in production — the pattern is proven.

---

## 4. Monarch Tokenizer

### 4.1 What is Monarch?

Monarch is Monaco Editor's built-in declarative tokenizer. It uses a state machine model with
regex-based token classification. It's used for **syntax highlighting** only (not validation).

### 4.2 Structure

```typescript
interface IMonarchLanguage {
    defaultToken: string;           // token for unclassified input
    ignoreCase?: boolean;
    brackets?: Array<{open: string; close: string; token: string}>;
    keywords?: string[];            // keywords (highlighted as 'keyword')
    typeKeywords?: string[];        // type names (highlighted as 'type')
    operators?: string[];           // operators
    tokenizer: {
        [stateName: string]: IShortMonarchLanguageRule[];
    };
}
```

### 4.3 Rule Format

```typescript
type MonarchRule =
    [RegExp, string | MonarchRuleAction];  // simple rule

// Or with advanced options:
type MonarchRuleAction = {
    token: string;
    next?: string;           // transition to named state
    nextEmbedded?: string;   // embed a different language
    bracket?: '@open' | '@close';
    log?: string;            // debug logging
    cases?: {               // conditional token assignment
        [keyword: string]: string;
        '@default': string;
    };
};
```

### 4.4 Complete Example: AUDESYS Config Tokenizer

(This is the working tokenizer from `theia-extensions/workshop-playground/`)

```typescript
// Highlights .audesys files with these token classes:
//   keyword: device, signal, channel, controller, hal, bind, ...
//   type: Bool, S8, U8, S16, U16, S32, U32, F32, F64, String, Blob
//   comment: # ...    and    ### ... ###
//   string: "..."
//   number: 42, 3.14
//   delimiter.curly/square/parenthesis: { } [ ] ( )
import { languages } from 'monaco-editor/esm/vs/editor/editor.api';

export function registerAudESYSConfigLanguage(): void {
    languages.register({ id: 'audesys-config' });
    languages.setMonarchTokensProvider('audesys-config', {
        defaultToken: 'invalid',
        keywords: [
            'device', 'signal', 'channel', 'controller', 'hal',
            'bind', 'connect', 'expose', 'map', 'publish', 'subscribe',
        ],
        typeKeywords: [
            'Bool', 'S8', 'U8', 'S16', 'U16', 'S32', 'U32', 'F32', 'F64',
            'String', 'Blob',
        ],
        brackets: [
            { open: '{', close: '}', token: 'delimiter.curly' },
            { open: '[', close: ']', token: 'delimiter.square' },
            { open: '(', close: ')', token: 'delimiter.parenthesis' },
        ],
        tokenizer: {
            root: [
                [/###/, 'comment', '@commentBlock'],
                [/#.*$/, 'comment'],
                [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
                [/\d+\.\d+/, 'number.float'],
                [/\d+/, 'number'],
                [/[a-zA-Z_]\w*/, {
                    cases: {
                        'typeKeywords': 'type',
                        'keywords': 'keyword',
                        '@default': 'identifier',
                    },
                }],
                [/[{}()[\]]/, '@brackets'],
                [/\s+/, 'white'],
            ],
            string: [
                [/[^\\"]+/, 'string'],
                [/\\./, 'string.escape'],
                [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
            ],
            commentBlock: [
                [/\*\//, 'comment', '@pop'],
                [/[^*]+/, 'comment'],
                [/\*/, 'comment'],
            ],
        },
    });
}
```

### 4.5 State Machine Pattern

```
        ┌──────────────┐
   ┌───►│    root      │◄─── (default state)
   │    └──┬───┬───┬───┘
   │       │   │   │
   │    ###│ " │   │
   │       │   │   │
   │  ┌────▼┐┌─▼──┐
   └──┤ cmt  ││str │
      └──────┘└────┘
       @pop     @pop
```

### 4.6 Registration Timing

**IMPORTANT:** `languages.register()` and `setMonarchTokensProvider()` must be called AFTER
Monaco is initialized. In a Theia extension, this typically happens in a
`FrontendApplicationContribution.onStart()` method, or by contributing to
`LanguageGrammarDefinitionContribution`:

```typescript
// Correct way to register a language in Theia (production pattern):
@injectable()
export class AudESYSGrammarContribution implements LanguageGrammarDefinitionContribution {
    registerTextmateLanguage(registry: TextmateRegistry): void {
        // For TextMate grammars (more powerful than Monarch)
    }

    // For Monarch (simpler):
    async onStart(): Promise<void> {
        registerAudESYSConfigLanguage();
    }
}
```

---

## 5. Gotchas and Lessons Learned

### 5.1 DI Gotchas

| Gotcha | Symptom | Fix |
|--------|---------|-----|
| Missing `@injectable()` | Runtime error: "Missing required @injectable annotation" | Add `@injectable()` to every class created by DI |
| Wrong bind target | Wrong implementation injected | Check bind chain: `bind(Symbol).to(Class)` |
| `inSingletonScope()` missing | Multiple instances, state not shared | Default is transient — use `inSingletonScope()` explicitly |
| Ordering issue with `bindContributionProvider` | Empty contribution list | `bindContributionProvider()` must be called BEFORE contributions are bound |
| Circular dependency | Stack overflow at startup | Break cycle with `@postConstruct()` or lazy injection |
| `@optional()` missing | Service not found error | Use `@optional()` for optional dependencies |

### 5.2 Extension Registration Gotchas

| Gotcha | Symptom | Fix |
|--------|---------|-----|
| `theiaExtensions` path wrong | Extension silently not loaded | Check `package.json` paths — they're relative to the package root |
| Missing `theia-extension` keyword | Theia CLI doesn't discover extension | Add `"keywords": ["theia-extension"]` to `package.json` |
| Frontend/backend mismatch | Extension loaded but contributions don't appear | Commands/widgets/menus = frontend. Language servers = backend |
| Version mismatch with `@theia/core` | Compilation errors | Always match `@theia/core` version in all extensions and the app |

### 5.3 Monarch Gotchas

| Gotcha | Symptom | Fix |
|--------|---------|-----|
| Rule ordering matters | Wrong token assigned | More specific regex first, general regex last |
| `@pop` missing in sub-state | Stuck in string/comment state forever | Every sub-state needs a path back to `root` |
| `defaultToken` = 'invalid' | Red squiggles everywhere | Set to `''` or `'source'` if unsure |
| `cases` with `@default` missing | Identifiers not highlighted | Always include `'@default': 'identifier'` |
| Double-escape in regex strings | Regex doesn't match | Remember: `\\` = literal `\` in JS string regex |
| Forget `languages.register()` | Tokenizer silently ignored | Call `languages.register({ id })` BEFORE `setMonarchTokensProvider()` |

### 5.4 Build/TypeScript Gotchas

| Gotcha | Symptom | Fix |
|--------|---------|-----|
| `experimentalDecorators: true` missing | `@injectable()` causes TS error | Required for inversify decorators |
| `emitDecoratorMetadata: true` missing | DI silently uses wrong types | Required for `@inject()` type inference |
| `composite: true` with references | Build order issues | Use `composite: true` when other TS projects reference yours |
| `skipLibCheck: true` on strict code | Hidden type errors | Theia recommends `skipLibCheck: true` due to monaco types |

### 5.5 Theia-Specific Gotchas

| Gotcha | Symptom | Fix |
|--------|---------|-----|
| Using `@theia/core` directly instead of `@theia/core/shared/inversify` | Duplicate inversify instance, DI container mismatch | ALWAYS import inversify through Theia: `import { injectable, inject } from '@theia/core/shared/inversify'` |
| Creating widgets without `WidgetManager` | Widget not rendered | Use `WidgetManager.getOrCreateWidget()` instead of `new MyWidget()` |
| dispatchOnConnection issue | RPC not working | Theia's `JsonRpcProxy` pattern must use `ConnectionHandler` on backend |
| Not waiting for app ready | Services unavailable | Use `FrontendApplicationContribution.onStart()` for startup logic |
| Monaco API version mismatch | Compilation errors | Theia pins Monaco version — don't install `monaco-editor` separately |

### 5.6 GLSP-Specific Gotchas

| Gotcha | Symptom | Fix |
|--------|---------|-----|
| GModel IDs not unique | Rendering glitches, wrong element selected | Always use `modelState.nextId()` or UUID |
| Forgetting `modelLock` | Concurrent modification during layout | Always synchronize on `modelSubmissionHandler.modelLock` |
| Not calling `submitModel()` after edit | Diagram doesn't update | Every ActionHandler.execute() must return/submit model changes |
| Server-side layout unexpected | Elements repositioned after edit | Check `DiagramConfiguration.needsClientLayout()` |
| Type hints not registered | Tool palette empty | Register node/edge type hints in `DiagramConfiguration` |

### 5.7 Summary: Top 5 Most Frequent Mistakes

1. **Importing from wrong inversify** — always use `@theia/core/shared/inversify`
2. **Missing `@injectable()`** — the #1 cause of DI failures
3. **Transient vs singleton** — default is transient, explicitly set `inSingletonScope()`
4. **Rule ordering in Monarch** — most specific first, `@default` last
5. **Not registering in ContainerModule** — writing a contribution class but forgetting to bind it

---

## Appendix: Key Resources

| Resource | URL |
|----------|-----|
| Theia Authoring Extensions | https://theia-ide.org/docs/authoring_extensions/ |
| Services and Contributions | https://theia-ide.org/docs/services_and_contributions/ |
| Commands/Menus/Keybindings | https://theia-ide.org/docs/commands_keybindings/ |
| InversifyJS Docs | https://github.com/inversify/InversifyJS |
| Monarch Tokenizer Reference | https://microsoft.github.io/monaco-editor/monarch.html |
| GLSP Documentation | https://eclipse.dev/glsp/documentation/ |
| GLSP Protocol Spec | https://eclipse.dev/glsp/documentation/protocol/ |
| GLSP GitHub | https://github.com/eclipse-glsp/glsp |
| Theia Extension Generator | https://github.com/eclipse-theia/generator-theia-extension |
| AUDESYS Studio Theia | `apps/studio-theia/` |
| AUDESYS Core Extension | `theia-extensions/audesys-core/` |
| Workshop Playground | `theia-extensions/workshop-playground/` |

---

## Appendix: Project Files Reference

```
theia-extensions/workshop-playground/
├── package.json                          # Extension metadata + deps
├── tsconfig.json                         # TS config with decorators
└── src/
    └── browser/
        ├── index.ts                      # Entry point (re-exports module)
        ├── workshop-playground-frontend-module.ts  # DI bindings
        ├── workshop-playground-contribution.ts     # Command + Menu contributions
        └── audesys-config-language.ts     # Monarch tokenizer
```

The playground extension demonstrates ALL four workshop topics:
- **DI**: `ContainerModule` + `@injectable()` + `@inject()` in the contribution class
- **Contributions**: One class implements `CommandContribution` + `MenuContribution`
- **Monarch**: `audesys-config-language.ts` — working tokenizer for a mini DSL
- **GLSP**: Documented above (no running server — learning exercise only)
