import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { metadataForLocation, SHARE_IMAGE } from '../../lib/siteSeo';

export const PageMetadata = () => {
  const { pathname, search } = useLocation();
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    const page = metadataForLocation({ pathname, search }, isAuthenticated);
    document.title = page.title;
    const set = (attribute, key, value) => {
      let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
      if (!tag) { tag = document.createElement('meta'); tag.setAttribute(attribute, key); document.head.append(tag); }
      tag.content = value;
    };
    set('name', 'description', page.description);
    set('name', 'robots', page.robots);
    for (const [key, value] of Object.entries({ title: page.title, description: page.description, url: page.canonical, image: SHARE_IMAGE })) set('property', `og:${key}`, value);
    for (const [key, value] of Object.entries({ title: page.title, description: page.description, image: SHARE_IMAGE })) set('name', `twitter:${key}`, value);
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
    canonical.href = page.canonical;
  }, [pathname, search, isAuthenticated]);
  return null;
};
