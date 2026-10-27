'use client';

/** Tab: chữ + gạch chân trên một đường kẻ chạy hết bề ngang, khác hẳn ô lọc. */
export function Tabs<T extends string>({
  items, value, onChange, label,
}: {
  items: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((t) => (
        <button
          key={t.id} type="button" role="tab" aria-selected={t.id === value}
          className={t.id === value ? 'tab on' : 'tab'} onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
