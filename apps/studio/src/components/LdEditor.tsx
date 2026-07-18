import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./LdEditor.css";

// ── Types ──
type ContactType = "NO" | "NC";
type CoilType = "OUT" | "SET" | "RESET";
type ElementType = ContactType | CoilType;

interface ContactSlot {
  type: ContactType;
  addr: number;
}

interface CoilSlot {
  type: CoilType;
  addr: number;
}

interface Rung {
  contacts: (ContactSlot | null)[];
  coil: CoilSlot | null;
}

const CONTACT_COUNT = 5;
const INITIAL_RUNGS = 10;

// ── Palette items ──
const PALETTE: { type: ElementType; label: string; group: string }[] = [
  { type: "NO", label: "NO Contact", group: "Contacts" },
  { type: "NC", label: "NC Contact", group: "Contacts" },
  { type: "OUT", label: "Output Coil", group: "Coils" },
  { type: "SET", label: "Set Coil", group: "Coils" },
  { type: "RESET", label: "Reset Coil", group: "Coils" },
];

function isContact(t: ElementType): t is ContactType {
  return t === "NO" || t === "NC";
}

function isCoil(t: ElementType): t is CoilType {
  return t === "OUT" || t === "SET" || t === "RESET";
}

// ── Codegen ──
function rungToLdText(rungs: Rung[]): string {
  const lines: string[] = [];
  let globalAddr = 1;

  for (let i = 0; i < rungs.length; i++) {
    const rung = rungs[i];
    lines.push(`NETWORK ${i + 1}`);

    for (const c of rung.contacts) {
      if (c) {
        const addr = c.addr || globalAddr++;
        lines.push(`${c.type} ${addr}`);
        // ponytail: mutate in-place for simplicity
        (c as { addr: number }).addr = addr;
      }
    }

    if (rung.coil) {
      const addr = rung.coil.addr || globalAddr++;
      lines.push(`${rung.coil.type} ${addr}`);
      (rung.coil as { addr: number }).addr = addr;
    }

    lines.push("END_NETWORK");
  }

  return lines.join("\n");
}

// ── Element icon component ──
function ElementIcon({ type, addr }: { type: ElementType; addr?: number }) {
  const cls = `ld-element ld-element--${type.toLowerCase()}`;
  const label = isContact(type)
    ? type
    : type === "OUT"
      ? "()"
      : type === "SET"
        ? "(S)"
        : "(R)";
  return (
    <div className={cls}>
      {label}
      {addr !== undefined && <span className="ld-element__addr">{addr}</span>}
    </div>
  );
}

interface LdEditorProps {
  onCompile?: (ldText: string) => void;
}

export default function LdEditor({ onCompile }: LdEditorProps) {
  const [rungs, setRungs] = useState<Rung[]>(() =>
    Array.from({ length: INITIAL_RUNGS }, () => ({
      contacts: Array<ContactSlot | null>(CONTACT_COUNT).fill(null),
      coil: null,
    })),
  );
  const [selected, setSelected] = useState<ElementType | null>(null);
  const [compiling, setCompiling] = useState(false);
  const nextAddr = useRef(1);

  // Sync LD text to parent on every rung change so toolbar compile is always current
  useEffect(() => {
    onCompile?.(rungToLdText(rungs));
  }, [rungs, onCompile]);

  const handlePaletteClick = useCallback((type: ElementType) => {
    setSelected((prev) => (prev === type ? null : type));
  }, []);

  const handleContactClick = useCallback(
    (rungIdx: number, slotIdx: number) => {
      if (!selected || !isContact(selected)) return;

      setRungs((prev) => {
        const next = prev.map((r, ri) => {
          if (ri !== rungIdx) return r;
          const contacts = [...r.contacts];
          const current = contacts[slotIdx];

          if (current) {
            // Remove
            contacts[slotIdx] = null;
          } else {
            // Add
            contacts[slotIdx] = { type: selected, addr: nextAddr.current++ };
          }
          return { ...r, contacts };
        });
        return next;
      });
    },
    [selected],
  );

  const handleCoilClick = useCallback(
    (rungIdx: number) => {
      if (!selected || !isCoil(selected)) return;

      setRungs((prev) => {
        const next = prev.map((r, ri) => {
          if (ri !== rungIdx) return r;
          const current = r.coil;

          if (current) {
            return { ...r, coil: null };
          }
          return { ...r, coil: { type: selected, addr: nextAddr.current++ } };
        });
        return next;
      });
    },
    [selected],
  );

  const handleAddRung = useCallback(() => {
    setRungs((prev) => [
      ...prev,
      { contacts: Array<ContactSlot | null>(CONTACT_COUNT).fill(null), coil: null },
    ]);
  }, []);

  const handleRemoveRung = useCallback(() => {
    setRungs((prev) => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  const handleCompile = useCallback(async () => {
    const ldText = rungToLdText(rungs);
    setCompiling(true);
    try {
      await invoke("compile_ld", { source: ldText });
    } catch (e) {
      // ponytail: errors surface through App's error handling
    } finally {
      setCompiling(false);
    }
  }, [rungs]);

  return (
    <div className="ld-editor">
      {/* Toolbar */}
      <div className="ld-editor__toolbar">
        <button className="ld-editor__toolbar-btn" onClick={handleAddRung}>
          + Add Rung
        </button>
        <button className="ld-editor__toolbar-btn" onClick={handleRemoveRung}>
          − Remove Rung
        </button>
        <span style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginLeft: 8 }}>
          {rungs.length} rung{rungs.length !== 1 ? "s" : ""}
        </span>
        <button
          className="ld-editor__toolbar-btn ld-editor__toolbar-btn--compile"
          onClick={handleCompile}
          disabled={compiling}
        >
          {compiling ? "Compiling..." : "Compile"}
        </button>
      </div>

      {/* Workspace */}
      <div className="ld-editor__workspace">
        {/* Palette */}
        <div className="ld-editor__palette">
          {(["Contacts", "Coils"] as const).map((group) => (
            <div key={group}>
              <div className="ld-editor__palette-label">{group}</div>
              {PALETTE.filter((p) => p.group === group).map((item) => (
                <div
                  key={item.type}
                  className={`ld-editor__palette-item${selected === item.type ? " ld-editor__palette-item--selected" : ""}`}
                  onClick={() => handlePaletteClick(item.type)}
                >
                  <div className="ld-editor__palette-item__icon">
                    <ElementIcon type={item.type} />
                  </div>
                  <span className="ld-editor__palette-item__name">{item.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="ld-editor__grid-wrap">
          <div className="ld-editor__grid">
            {rungs.map((rung, ri) => (
              <div key={ri} className="ld-editor__rung">
                <div className="ld-editor__rung-label">{String(ri + 1).padStart(2, "0")}</div>
                <div className="ld-editor__rail ld-editor__rail--left" />

                {/* Contact slots */}
                <div className="ld-editor__contacts">
                  {rung.contacts.map((contact, ci) => (
                    <div key={ci} style={{ display: "flex", alignItems: "center" }}>
                      {contact ? (
                        <div
                          className="ld-editor__slot ld-editor__slot--filled"
                          onClick={() => handleContactClick(ri, ci)}
                          title="Click to remove"
                        >
                          <ElementIcon type={contact.type} addr={contact.addr} />
                        </div>
                      ) : (
                        <div
                          className="ld-editor__slot"
                          onClick={() => handleContactClick(ri, ci)}
                          title={selected && isContact(selected) ? `Add ${selected}` : "Select a contact from palette"}
                        />
                      )}
                      {ci < CONTACT_COUNT - 1 && <div className="ld-editor__wire" />}
                    </div>
                  ))}
                </div>

                {/* Coil slot */}
                {rung.coil ? (
                  <div
                    className="ld-editor__coil-slot ld-editor__coil-slot--filled"
                    onClick={() => handleCoilClick(ri)}
                    title="Click to remove"
                  >
                    <ElementIcon type={rung.coil.type} addr={rung.coil.addr} />
                  </div>
                ) : (
                  <div
                    className="ld-editor__coil-slot"
                    onClick={() => handleCoilClick(ri)}
                    title={selected && isCoil(selected) ? `Add ${selected}` : "Select a coil from palette"}
                  />
                )}

                <div className="ld-editor__rail ld-editor__rail--right" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
