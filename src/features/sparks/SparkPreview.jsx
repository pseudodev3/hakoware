import { useEffect, useState } from 'react';
import { Image, Sparkles } from 'lucide-react';
import { getSparks } from '../../services/sparkService';
import { UserAvatar } from '../../shared/components/UserAvatar';
import './SparkPreview.css';

export const SparkPreview = ({ onNavigate }) => {
  const [posts, setPosts] = useState(null);
  useEffect(() => { let alive = true; void getSparks({ limit: 3 }).then(data => { if (alive) setPosts(data.posts); }).catch(() => { if (alive) setPosts([]); }); return () => { alive = false; }; }, []);
  return <section className="home-sparks" aria-label="Recent Sparks"><header><h2>Your circle, lately</h2><button type="button" onClick={() => onNavigate('sparks')}>Sparks </button></header>
    {posts?.length ? <div className="home-spark-list">{posts.map(post => <button type="button" key={post.id} aria-label={`Open ${post.author.displayName}’s Spark`} onClick={() => onNavigate('sparks', { focusPostId: post.id })}><UserAvatar person={post.author} size="sm" decorative /><span><strong>{post.author.displayName}</strong><small>{post.imageUrl && <Image size={12} />}{post.text || 'Shared a photo'}</small></span></button>)}</div> : <button type="button" className="home-sparks-empty" onClick={() => onNavigate('sparks')}><Sparkles size={20} /><span><strong>{posts === null ? 'Opening your circle’s moments…' : 'The little stuff is the good stuff.'}</strong><small>{posts === null ? 'Photos and thoughts from your people.' : 'Share a photo or a small win with your circle.'}</small></span></button>}
  </section>;
};
