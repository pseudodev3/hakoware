export const ViewTabs = ({ id, label, items, value, onChange, className }) => (
  <div className={className} role="tablist" aria-label={label}>
    {items.map((item, index) => <button
      type="button"
      key={item.value}
      id={`${id}-tab-${item.value}`}
      role="tab"
      aria-selected={value === item.value}
      aria-controls={`${id}-panel-${item.value}`}
      tabIndex={value === item.value ? 0 : -1}
      className={value === item.value ? 'active' : ''}
      onClick={() => onChange(item.value)}
      onKeyDown={(event) => {
        const offset = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
        if (!offset && !['Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + offset + items.length) % items.length;
        onChange(items[next].value);
        event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
      }}
    >{item.label}{item.count > 0 && <span>{item.count}</span>}</button>)}
  </div>
);
