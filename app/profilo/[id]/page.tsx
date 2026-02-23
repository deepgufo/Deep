'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { Upload, User as UserIcon, Menu, LogOut, Home, Film, UserPlus, UserCheck } from 'lucide-react';
import Image from 'next/image';

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  username: string;
  bio: string | null;
  gender: string;
}

export default function ProfiloAltrui() {
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;
  const menuRef = useRef<HTMLDivElement>(null);
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  
  // Stati Modal Modifica (solo per profilo proprio)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Stati Menu
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Caricamento profilo
  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        // Ottieni sessione utente corrente
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (sessionError || !session?.user) {
          console.error('Sessione non trovata:', sessionError);
          router.push('/auth');
          return;
        }

        setCurrentUserId(session.user.id);

        // Verifica se è il proprio profilo
        const ownProfile = session.user.id === profileId;
        setIsOwnProfile(ownProfile);

        // Se è il proprio profilo, redirect a /profilo
        if (ownProfile) {
          router.push('/profilo');
          return;
        }

        // Carica profilo dell'utente target
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, username, bio, gender')
          .eq('id', profileId)
          .single();

        if (!isMounted) return;

        if (profileError) {
          console.error('Errore caricamento profilo:', profileError);
          return;
        }

        if (profileData) {
          setProfile(profileData);
        }

        // Verifica se già segue questo utente
        const { data: followData } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', session.user.id)
          .eq('following_id', profileId)
          .single();

        if (followData) {
          setIsFollowing(true);
        }

      } catch (err) {
        console.error('Errore:', err);
        if (isMounted) {
          router.push('/auth');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [router, profileId]);

  const handleFollowToggle = async () => {
    if (!currentUserId || !profileId) return;

    setIsFollowingLoading(true);

    try {
      if (isFollowing) {
        // Smetti di seguire
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', profileId);

        if (error) {
          console.error('Errore unfollow:', error);
          return;
        }

        setIsFollowing(false);
      } else {
        // Segui
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: currentUserId,
            following_id: profileId
          });

        if (error) {
          console.error('Errore follow:', error);
          return;
        }

        setIsFollowing(true);
      }
    } catch (err) {
      console.error('Errore:', err);
    } finally {
      setIsFollowingLoading(false);
    }
  };

  const openEditModal = () => {
    if (profile) {
      setEditName(profile.full_name);
      setEditBio(profile.bio || '');
      setEditUsername(profile.username);
      setEditAvatarPreview(profile.avatar_url);
      setIsEditModalOpen(true);
    }
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditAvatarFile(null);
    setEditAvatarPreview(null);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfileChanges = async () => {
    if (!profile) return;

    setIsSavingProfile(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        alert('Sessione scaduta. Effettua nuovamente il login.');
        setIsSavingProfile(false);
        return;
      }

      let avatarUrl = profile.avatar_url;

      if (editAvatarFile) {
        const fileExt = editAvatarFile.name.split('.').pop();
        const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('avatars')
          .upload(fileName, editAvatarFile, { upsert: true });

        if (uploadError) {
          console.error('Errore upload avatar:', uploadError);
          alert('Errore durante il caricamento della foto.');
          setIsSavingProfile(false);
          return;
        }

        const { data: urlData } = supabaseAdmin.storage
          .from('avatars')
          .getPublicUrl(fileName);

        avatarUrl = urlData.publicUrl;
      }

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: session.user.id,
          full_name: editName,
          bio: editBio,
          username: editUsername,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (updateError) {
        console.error('Errore aggiornamento profilo:', updateError);
        alert('Errore durante il salvataggio.');
        setIsSavingProfile(false);
        return;
      }

      setProfile({
        ...profile,
        full_name: editName,
        bio: editBio,
        username: editUsername,
        avatar_url: avatarUrl,
      });

      alert('✅ Profilo aggiornato con successo!');
      closeEditModal();
    } catch (error) {
      console.error('Errore:', error);
      alert('Si è verificato un errore.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/auth');
    } catch (error) {
      console.error('Errore durante il logout:', error);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  // Click outside menu handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  if (isLoading && !profile) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Caricamento profilo...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 bg-black">
        <UserIcon className="w-16 h-16 text-gray-600 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Profilo non trovato</h2>
        <p className="text-gray-400 mb-4">Questo utente non esiste</p>
        <button
          onClick={handleGoBack}
          className="bg-yellow-400 text-black px-6 py-2 rounded-lg font-semibold hover:bg-yellow-300"
        >
          Torna Indietro
        </button>
      </div>
    );
  }

  return (
    <main className="fixed inset-0 bg-black overflow-hidden" style={{ height: '100dvh' }}>
      <div className="scrollable-content h-[calc(100%-60px)] overflow-y-auto">
        <div className="w-full max-w-2xl mx-auto bg-black min-h-full pb-8">
        
        {/* Header Top Bar */}
        <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-zinc-800">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={handleGoBack}
              className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center hover:border-yellow-400/60 transition-all duration-200"
              aria-label="Torna Indietro"
            >
              <Home className="w-5 h-5 text-zinc-400 hover:text-yellow-400 transition-colors" />
            </button>

            {isOwnProfile && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="w-9 h-9 rounded-lg bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center hover:bg-yellow-400/20 hover:border-yellow-400/60 hover:shadow-[0_0_15px_rgba(251,191,36,0.3)] transition-all duration-200"
                  aria-label="Menu"
                >
                  <Menu className="w-5 h-5 text-yellow-400" />
                </button>

                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-zinc-900 border border-zinc-700 shadow-[0_0_30px_rgba(0,0,0,0.8)] overflow-hidden animate-fadeIn">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-yellow-400/10 transition-colors group"
                    >
                      <LogOut className="w-5 h-5 text-yellow-400 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-medium">Esci dal profilo</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* PROFILO CENTRALE - Design DEEP */}
        <div className="flex flex-col items-center px-4 py-8">
          
          {/* Avatar Grande Centrato */}
          <div className="relative mb-6">
            <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-yellow-400 shadow-[0_0_30px_rgba(251,191,36,0.3)]">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                  priority
                  quality={85}
                />
              ) : (
                <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                  <UserIcon className="w-16 h-16 text-zinc-600" />
                </div>
              )}
            </div>
          </div>

          {/* Nome */}
          <h1 className="text-2xl font-bold text-white mb-2 text-center">
            {profile.full_name}
          </h1>

          {/* Username */}
          <p className="text-zinc-400 text-sm mb-4">
            @{profile.username}
          </p>

          {/* Statistiche Minimali */}
          <div className="flex items-center gap-6 mb-6">
            <div className="text-center">
              <p className="text-white font-bold text-lg">0</p>
              <p className="text-zinc-500 text-xs">Film Generati</p>
            </div>
            <div className="w-px h-10 bg-zinc-800"></div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">Drammatico</p>
              <p className="text-zinc-500 text-xs">Mood Preferito</p>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-zinc-300 text-sm text-center max-w-md leading-relaxed mb-6">
              {profile.bio}
            </p>
          )}

          {/* Linea Divisoria */}
          <div className="w-full max-w-md h-px bg-zinc-800 mb-6"></div>

          {/* Tasto Segui/Modifica - Logica condizionale */}
          {isOwnProfile ? (
            <button
              onClick={openEditModal}
              className="w-full max-w-md px-6 py-3 rounded-lg border-2 border-zinc-700 text-white font-medium text-sm hover:border-yellow-400 hover:text-yellow-400 hover:shadow-[0_0_20px_rgba(251,191,36,0.2)] transition-all duration-300"
            >
              Modifica Profilo
            </button>
          ) : (
            <button
              onClick={handleFollowToggle}
              disabled={isFollowingLoading}
              className={`w-full max-w-md px-6 py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 ${
                isFollowing
                  ? 'bg-zinc-800 text-white border-2 border-zinc-700 hover:border-red-500 hover:text-red-500'
                  : 'bg-blue-500 text-white hover:bg-blue-600 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
              }`}
            >
              {isFollowingLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Caricamento...</span>
                </>
              ) : isFollowing ? (
                <>
                  <UserCheck className="w-5 h-5" />
                  <span>Seguito</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>Segui</span>
                </>
              )}
            </button>
          )}

          {/* Linea Divisoria */}
          <div className="w-full max-w-md h-px bg-zinc-800 my-8"></div>

          {/* Sezione Video - I SUOI FILM */}
          <div className="w-full max-w-md">
            <h2 className="text-white font-bold text-lg mb-4 tracking-wide">
              {isOwnProfile ? 'I TUOI FILM' : 'I SUOI FILM'}
            </h2>

            {/* Griglia Placeholder */}
            <div className="grid grid-cols-2 gap-4">
              <div className="aspect-[9/16] bg-zinc-900 rounded-lg border border-zinc-800 flex flex-col items-center justify-center hover:border-yellow-400/50 transition-colors cursor-pointer group">
                <Film className="w-12 h-12 text-zinc-700 group-hover:text-yellow-400 transition-colors mb-2" />
                <p className="text-zinc-600 text-xs">Nessun video</p>
              </div>

              <div className="aspect-[9/16] bg-zinc-900 rounded-lg border border-zinc-800 flex flex-col items-center justify-center hover:border-yellow-400/50 transition-colors cursor-pointer group">
                <Film className="w-12 h-12 text-zinc-700 group-hover:text-yellow-400 transition-colors mb-2" />
                <p className="text-zinc-600 text-xs">Nessun video</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Modifica Profilo (solo se è il proprio profilo) */}
        {isEditModalOpen && isOwnProfile && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <button onClick={closeEditModal} className="text-zinc-400 hover:text-white transition-colors">
                  Annulla
                </button>
                <h3 className="text-white font-semibold text-base">Modifica profilo</h3>
                <button
                  onClick={handleSaveProfileChanges}
                  disabled={isSavingProfile}
                  className="text-yellow-400 font-semibold hover:text-yellow-300 transition-colors disabled:opacity-50"
                >
                  {isSavingProfile ? 'Salvo...' : 'Salva'}
                </button>
              </div>

              <div className="p-4 max-h-[70vh] overflow-y-auto">
                <div className="flex flex-col items-center mb-6">
                  <div className="relative mb-3">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-800 border-2 border-zinc-700">
                      {editAvatarPreview ? (
                        <img src={editAvatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <UserIcon className="w-12 h-12 text-zinc-600" />
                        </div>
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center cursor-pointer hover:bg-yellow-300 transition-colors">
                      <Upload className="w-4 h-4 text-black" />
                      <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                    </label>
                  </div>
                  <p className="text-yellow-400 text-sm font-medium">Cambia foto</p>
                </div>

                <div className="mb-4">
                  <label className="text-zinc-400 text-xs mb-1 block">Nome</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-zinc-800 text-white px-4 py-2.5 rounded-lg border border-zinc-700 focus:border-yellow-400 focus:outline-none transition-colors"
                    placeholder="Il tuo nome"
                  />
                </div>

                <div className="mb-4">
                  <label className="text-zinc-400 text-xs mb-1 block">Username</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full bg-zinc-800 text-white px-4 py-2.5 rounded-lg border border-zinc-700 focus:border-yellow-400 focus:outline-none transition-colors"
                    placeholder="@username"
                  />
                </div>

                <div className="mb-4">
                  <label className="text-zinc-400 text-xs mb-1 block">Bio</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    rows={3}
                    className="w-full bg-zinc-800 text-white px-4 py-2.5 rounded-lg border border-zinc-700 focus:border-yellow-400 focus:outline-none transition-colors resize-none"
                    placeholder="Racconta qualcosa di te..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </main>
  );
}
