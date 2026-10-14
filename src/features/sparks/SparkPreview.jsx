import { useEffect, useState } from 'react';
import { Image, Sparkles } from 'lucide-react';
import { getSparks } from '../../services/sparkService';
import { UserAvatar } from '../../shared/components/UserAvatar';
import { useAuth } from '../../contexts/AuthContext';
import { sparkFailure } from '../../lib/sparkAvailability';
import './SparkPreview.css';

export const SparkPreview = ({ onNavigate }) => {
  const { user } = useAuth();
  const userId = String(user?.uid || user?.id || user?._id || '');
  const [attempt, setAttempt] = useState(0), [state, setState] = useState({ owner: null, posts: null, failure: null });
  const { posts, failure } = state.owner === userId ? state : { posts: null, failure: null };
  useEffect(() => {
    let alive = true; setState({ owner: userId, posts: null, failure: null });
    void getSparks({ limit: 3 }).then(data => { if (!Array.isArray(data?.posts)) throw new Error('Invalid feed'); if (alive) setState({ owner: userId, posts: data.posts, failure: null }); }).catch(error => { if (alive) setState({ owner: userId, posts: null, failure: sparkFailure(error) }); });
    return () => { alive = false; };
  }, [userId, attempt]);
  return <section className="home-sparks" aria-label="Recent Sparks"><header><h2>Your circle, lately</h2><button type="button" onClick={() => onNavigate('sparks')}>Sparks </button></header>
    {failure ? <div className="home-sparks-unavailable" role="status"><strong>{failure.title}</strong><p>{failure.message}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Check again</button></div> : posts === null ? <p className="home-sparks-loading" role="status">Opening your circle’s moments…</p> : posts.length ? <div className="home-spark-list">{posts.map(post => <button type="button" key={post.id} aria-label={`Open ${post.author.displayName}’s Spark`} onClick={() => onNavigate('sparks', { focusPostId: post.id })}><UserAvatar person={post.author} size="sm" decorative /><span><strong>{post.author.displayName}</strong><small>{post.imageUrl && <Image size={12} />}{post.text || 'Shared a photo'}</small></span></button>)}</div> : <button type="button" className="home-sparks-empty" onClick={() => onNavigate('sparks')}><Sparkles size={20} /><span><strong>The little stuff is the good stuff.</strong><small>Share a photo or a small win with your circle.</small></span></button>}
  </section>;
};
