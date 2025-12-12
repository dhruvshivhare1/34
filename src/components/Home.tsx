import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMode } from '../contexts/ModeContext';
import {
  Users,
  BookOpen,
  Lightbulb,
  Mail,
  Send,
  Heart,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type HomeProps = {
  onTabChange: (tab: string) => void;
};

interface Confession {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile_name?: string;
}

type InteractionState = {
  likes: number;
  liked: boolean;
};

export function Home({ onTabChange }: HomeProps) {
  const { user, profile } = useAuth();
  const { mode } = useMode();
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [newConfession, setNewConfession] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [interactions, setInteractions] = useState<Record<string, InteractionState>>({});

  useEffect(() => {
    fetchConfessions();
    const subscription = subscribeToConfessions();
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const fetchConfessions = async () => {
    try {
      const { data, error } = await supabase
        .from('confessions')
        .select(`
          id,
          user_id,
          content,
          created_at,
          profiles (college_name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        const formatted = data.map((c: any) => ({
          id: c.id,
          user_id: c.user_id,
          content: c.content,
          created_at: c.created_at,
          profile_name: c.profiles?.college_name
            ? `Someone from ${c.profiles.college_name}`
            : 'Someone from DU',
        }));
        setConfessions(formatted);
        setInteractions((prev) => {
          const next = { ...prev };
          formatted.forEach((f) => {
            if (!next[f.id]) {
              next[f.id] = { likes: 0, liked: false };
            }
          });
          return next;
        });
      }
    } catch (error) {
      console.error('Error fetching confessions:', error);
    }
    setLoading(false);
  };

  const subscribeToConfessions = () => {
    const channel = supabase
      .channel('confessions-' + Date.now())
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'confessions' },
        async (payload) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('college_name')
            .eq('id', payload.new.user_id)
            .maybeSingle();

          setConfessions((prev) => [
            {
              id: payload.new.id,
              user_id: payload.new.user_id,
              content: payload.new.content,
              created_at: payload.new.created_at,
              profile_name: profileData?.college_name
                ? `Someone from ${profileData.college_name}`
                : 'Someone from DU',
            },
            ...prev,
          ]);
          setInteractions((prev) => ({
            ...prev,
            [payload.new.id]: { likes: 0, liked: false },
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'confessions' },
        (payload) => {
          setConfessions((prev) => prev.filter((c) => c.id !== payload.old.id));
        }
      )
      .subscribe();

    return channel;
  };

  const toggleLike = (id: string) => {
    setInteractions((prev) => {
      const current = prev[id] ?? { likes: 0, liked: false };
      const liked = !current.liked;
      const likes = liked ? current.likes + 1 : Math.max(0, current.likes - 1);
      return { ...prev, [id]: { ...current, liked, likes } };
    });
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });

  if (mode === 'social') {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 pb-24 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Feed</p>
              <h1 className="text-xl font-bold text-black">Trending confessions</h1>
            </div>
            <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 border border-indigo-100 shadow-sm">
              {confessions.length} posts
            </div>
          </div>

          {/* Confessions List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : confessions.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-500">No confessions yet. Be the first!</div>
          ) : (
            <div className="space-y-3">
              {confessions.map((confession) => {
                const initial = confession.profile_name?.charAt(0)?.toUpperCase() || 'U';
                const state = interactions[confession.id] ?? { likes: 0, liked: false };
                return (
                  <div
                    key={confession.id}
                    className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 space-y-3 text-sm hover:shadow-md transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                          {initial}
                        </div>
                        <div>
                          <p className="text-black text-sm font-semibold leading-tight">
                            {confession.profile_name}
                          </p>
                          <p className="text-gray-600 text-xs">{formatDate(confession.created_at)}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">
                        Confession
                      </span>
                    </div>

                    <div className="text-black text-base leading-relaxed">{confession.content}</div>

                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => toggleLike(confession.id)}
                          className={`flex items-center gap-1 transition ${
                            state.liked ? 'text-pink-600' : 'text-black hover:text-pink-600'
                          }`}
                        >
                          <Heart
                            className="w-4 h-4"
                            fill={state.liked ? 'currentColor' : 'none'}
                            strokeWidth={state.liked ? 0 : 2}
                          />
                          <span className="font-semibold text-black">
                            {state.likes ? state.likes : 'Like'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Common homepage for all modes: Banner + Confessions
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 mb-8 text-white shadow-lg">
        <h1 className="text-3xl font-bold mb-2">Welcome back, {profile?.name}!</h1>
        <p className="text-blue-100 text-lg">
          {profile?.college_name} • {profile?.course}
        </p>
        {profile?.unique_trait && (
          <p className="mt-4 text-blue-50 italic">"{profile.unique_trait}"</p>
        )}
      </div>

      {/* Confessions Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">What's on everyone's mind?</h2>

        {/* Confessions List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : confessions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No confessions yet. Be the first!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {confessions.map((confession) => (
              <div
                key={confession.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-md transition shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-blue-600 font-semibold text-sm mb-2">
                      {confession.profile_name}
                    </p>
                    <p className="text-gray-900 leading-relaxed break-words">
                      {confession.content}
                    </p>
                    <p className="text-gray-600 text-xs mt-3">
                      {new Date(confession.created_at).toLocaleDateString(
                        [],
                        {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
