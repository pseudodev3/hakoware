import './PageHeading.css';

export const PageHeading = ({ title, description, children, className = '', headingRef, headingId }) => (
  <header className={`page-heading ${className}`}>
    <div className="page-heading-copy">
      <h1 ref={headingRef} id={headingId} tabIndex={headingRef ? -1 : undefined}>{title}</h1>
      {description && <p className="page-heading-description">{description}</p>}
    </div>
    {children && <div className="page-heading-action">{children}</div>}
  </header>
);
