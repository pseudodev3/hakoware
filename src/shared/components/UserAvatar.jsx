import React, { useEffect, useState } from 'react';
import { resolveApiMediaUrl } from '../../lib/api';
import './UserAvatar.css';

const initialFor = (person) => (
  person?.displayName?.[0]?.toUpperCase()
  || person?.username?.[0]?.toUpperCase()
  || '?'
);

export const UserAvatar = ({
  person,
  className = '',
  size = 'md',
  alt,
  decorative = false
}) => {
  const src = resolveApiMediaUrl(person?.avatar);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  const label = alt ?? (person?.displayName || person?.username || 'User');

  return (
    <span
      className={`user-avatar user-avatar-${size} ${className}`.trim()}
      aria-hidden={decorative ? 'true' : undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initialFor(person)}</span>
      )}
    </span>
  );
};
