import { useEffect, useRef, useState } from 'react';
import { messageParts } from '../../lib/chatLinks';
import { loadChatImage, loadChatLink } from '../../services/chatLinkService';
import './ChatMessageText.css';

export const ChatMessageText = ({ text, kind, messageId, onLayout }) => {
  const parts = messageParts(text), hasLink = parts.some(part => part.href);
  const anchor = useRef(null), layout = useRef(onLayout);
  const [preview, setPreview] = useState(null), [image, setImage] = useState('');
  layout.current = onLayout;
  useEffect(() => {
    if (!hasLink || !messageId) return;
    let alive = true, started = false, objectURL;
    const controller = new AbortController();
    setPreview(null); setImage('');
    const start = async () => {
      if (started) return; started = true;
      const context = { kind, messageId };
      try {
        const result = await loadChatLink(context);
        if (!alive || result.status !== 'READY') return;
        setPreview(result);
        if (result.imageVersion) {
          const blob = await loadChatImage(context, result.imageVersion, controller.signal);
          if (alive) { objectURL = URL.createObjectURL(blob); setImage(objectURL); }
        }
      } catch { /* The message and its original link remain usable. */ }
    };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void start(); }
    }, { rootMargin: '200px' });
    if (observer && anchor.current) observer.observe(anchor.current); else void start();
    return () => { alive = false; controller.abort(); observer?.disconnect(); if (objectURL) URL.revokeObjectURL(objectURL); };
  }, [hasLink, kind, messageId]);
  useEffect(() => { if (preview) layout.current?.(); }, [preview, image]);
  return <>
    <p ref={anchor}>{parts.map((part, index) => part.href ? <a key={index} className="chat-text-link" href={part.href} target="_blank" rel="noopener noreferrer">{part.text}</a> : part.text)}</p>
    {preview && <a className="chat-link-preview" href={preview.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${preview.title} on ${preview.domain}`}>
      <span className="chat-link-copy"><span className="chat-link-domain">{preview.domain.replace(/^www\./, '')}</span><strong>{preview.title}</strong>{preview.description && <span className="chat-link-description">{preview.description}</span>}</span>
      {preview.imageVersion && <span className={`chat-link-picture ${image ? 'is-loaded' : ''}`} aria-hidden="true">{image && <img src={image} alt="" width="76" height="92" onError={() => setImage('')} />}</span>}
    </a>}
  </>;
};
