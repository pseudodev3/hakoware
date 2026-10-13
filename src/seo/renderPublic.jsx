import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { LandingPage } from '../features/landing/LandingPage';
import { LegalPage } from '../features/legal/LegalPage';

// Only public, anonymous content is rendered. This never restores an account,
// reads a database, or requests messages, purchases or other private data.
export const renderPublic = path => renderToString(
  <StaticRouter location={path}>
    {path === '/' ? <LandingPage onEnter={() => {}} /> : <LegalPage type={path.slice(1)} />}
  </StaticRouter>
);
