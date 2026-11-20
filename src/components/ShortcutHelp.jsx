import React from "react";
import { useHotkeyList } from "../hooks/useHotkeys";
import { Kbd, Modal } from "./ui";

const INPUT_KEYS = [
  ["arrowup", "Increase value (~1% step)"],
  ["arrowdown", "Decrease value"],
  ["shift+arrowup", "Step ×10"],
  ["alt+arrowup", "Step ×0.1"],
  ["enter", "Next field"],
  ["shift+enter", "Previous field"],
  ["escape", "Leave field"],
];

export default function ShortcutHelp({ onClose }) {
  const list = useHotkeyList();
  const groups = {};
  for (const b of list) {
    if (b.group === "Dialog") continue;
    (groups[b.group] ||= []).push(b);
  }
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} wide>
      <div className="shortcutGrid">
        {Object.entries(groups).map(([group, items]) => (
          <section key={group}>
            <h4>{group}</h4>
            {items.map((b) => (
              <div className="shortcut" key={b.id}>
                <span>{b.label}</span>
                <span className="keys">
                  {b.keys.map((k) => (
                    <Kbd key={k} combo={k} className="always" />
                  ))}
                </span>
              </div>
            ))}
          </section>
        ))}
        <section>
          <h4>Number inputs</h4>
          {INPUT_KEYS.map(([k, label]) => (
            <div className="shortcut" key={k}>
              <span>{label}</span>
              <span className="keys">
                <Kbd combo={k} className="always" />
              </span>
            </div>
          ))}
        </section>
      </div>
      <p className="muted tiny">Single-key shortcuts are ignored while typing in a field; Alt+number tab switching works everywhere.</p>
    </Modal>
  );
}
