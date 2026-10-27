'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';

/**
 * Ô lọc: nhãn nằm TRÊN ô, giá trị nằm TRONG ô ("All", "Environment", "Environment +2").
 * Chọn nhiều, có dòng "All" tích hết / bỏ hết với trạng thái gạch ngang khi chọn một phần.
 * Chưa chọn gì và chọn hết đều là KHÔNG LỌC. Mẫu theo Website_SaleCheckIn/src/components/Loc.tsx.
 */

export interface Option { v: string; label: string }

/** Tập đang lọc, hoặc `null` khi KHÔNG lọc (chưa chọn gì / chọn hết). */
export function activeSet(chosen: string[], options: Option[]): Set<string> | null {
  if (chosen.length === 0) return null;
  const s = new Set(chosen);
  return options.length > 0 && options.every((o) => s.has(o.v)) ? null : s;
}

export function Loc({
  label, options, chosen, onChange,
}: {
  label: string;
  options: Option[];
  chosen: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const labelId = useId();

  const all = options.length > 0 && options.every((o) => chosen.includes(o.v));
  const filtering = chosen.length > 0 && !all;
  const byValue = useMemo(() => new Map(options.map((o) => [o.v, o.label])), [options]);
  const summary = !filtering
    ? 'All'
    : `${byValue.get(chosen[0]!) ?? chosen[0]}${chosen.length > 1 ? ` +${chosen.length - 1}` : ''}`;

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', esc); };
  }, [open]);

  const toggle = (v: string) => onChange(chosen.includes(v) ? chosen.filter((x) => x !== v) : [...chosen, v]);

  return (
    <div className="loc" ref={root}>
      <span className="loc-label" id={labelId}>{label}</span>
      <button
        ref={btn} type="button" className={filtering ? 'loc-btn active' : 'loc-btn'}
        aria-haspopup="listbox" aria-expanded={open} aria-labelledby={labelId}
        onClick={() => setOpen(!open)}
      >
        <span className="loc-value">{summary}</span>
        <Icon name="chev-down" size={16} />
      </button>
      {open && (
        <div className="loc-pop">
          <ul role="listbox" aria-multiselectable aria-labelledby={labelId}>
            <li role="option" aria-selected={all}>
              <button
                type="button" className={`loc-item all ${all ? 'on' : filtering ? 'partial' : ''}`}
                onClick={() => onChange(all ? [] : options.map((o) => o.v))}
              >
                <span className="box" aria-hidden="true">
                  {filtering ? <span className="dash" /> : <Icon name="check" size={12} />}
                </span>
                All
              </button>
            </li>
            {options.map((o) => (
              <li key={o.v} role="option" aria-selected={chosen.includes(o.v)}>
                <button type="button" className={chosen.includes(o.v) ? 'loc-item on' : 'loc-item'} onClick={() => toggle(o.v)}>
                  <span className="box" aria-hidden="true"><Icon name="check" size={12} /></span>
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Tiêu đề cột bấm để sắp. Mũi tên luôn chiếm chỗ để hàng tiêu đề không nhích. */
export function SortButton({
  label, active, desc, onClick,
}: { label: string; active: boolean; desc: boolean; onClick: () => void }) {
  return (
    <button type="button" className={active ? 'sort-btn on' : 'sort-btn'} onClick={onClick}>
      {label}
      <span className="sort-arrow" aria-hidden="true">{active ? (desc ? '▼' : '▲') : '↕'}</span>
    </button>
  );
}
