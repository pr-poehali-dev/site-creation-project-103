import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  avatar: string | null;
  bio: string;
  donateLink: string;
  createdAt: number;
}

interface Comment {
  id: string;
  userId: string;
  username: string;
  userAvatar: string | null;
  text: string;
  createdAt: number;
}

interface Video {
  id: string;
  title: string;
  description: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  url: string;
  thumbnail: string | null;
  views: number;
  viewedBy: string[];
  likes: string[];
  dislikes: string[];
  comments: Comment[];
  duration: string;
  uploadedAt: number;
  quality: string;
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  users: "yuvist_users",
  currentUser: "yuvist_current_user",
  videos: "yuvist_videos",
  theme: "yuvist_theme",
  subscriptions: "yuvist_subscriptions",
  history: "yuvist_history",
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + " млн";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + " тыс";
  return String(n);
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const mo = Math.floor(d / 30);
  const y = Math.floor(d / 365);
  if (y > 0) return `${y} г. назад`;
  if (mo > 0) return `${mo} мес. назад`;
  if (d > 0) return `${d} дн. назад`;
  if (h > 0) return `${h} ч. назад`;
  if (m > 0) return `${m} мин. назад`;
  return "только что";
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── AVATAR ──────────────────────────────────────────────────────────────────

function Avatar({ src, name, size = 36 }: { src: string | null; name: string; size?: number }) {
  const colors = ["#e53935", "#8e24aa", "#1e88e5", "#00897b", "#f4511e", "#3949ab"];
  const color = colors[name.charCodeAt(0) % colors.length];
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", background: color,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontWeight: 700, fontSize: size * 0.4,
        flexShrink: 0, fontFamily: "Golos Text",
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── VIDEO PLAYER ────────────────────────────────────────────────────────────

function VideoPlayer({
  video, currentUser, onUpdate,
}: {
  video: Video; currentUser: User | null; onUpdate: (v: Video) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewCounted = useRef(false);

  const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onTime = () => {
      setCurrentTime(el.currentTime);
      if (!viewCounted.current && el.currentTime > 5 && currentUser) {
        const uid = currentUser.id;
        if (!video.viewedBy.includes(uid)) {
          viewCounted.current = true;
          const updated = { ...video, views: video.views + 1, viewedBy: [...video.viewedBy, uid] };
          onUpdate(updated);
        }
      }
    };
    const onDur = () => setDuration(el.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("durationchange", onDur);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("durationchange", onDur);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [video, currentUser, onUpdate]);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (playing) { el.pause(); } else { void el.play(); }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = parseFloat(e.target.value);
  };

  const setVol = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (videoRef.current) videoRef.current.volume = v;
    setMuted(v === 0);
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !muted;
    setMuted(!muted);
  };

  const changeSpeed = (s: number) => {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
    setShowSpeedMenu(false);
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  };

  return (
    <div
      className="relative bg-black rounded-xl overflow-hidden"
      style={{ aspectRatio: "16/9" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <video ref={videoRef} src={video.url} className="w-full h-full" onClick={togglePlay} style={{ cursor: "pointer" }} />

      <div
        className="absolute bottom-0 left-0 right-0 transition-opacity duration-300"
        style={{
          opacity: showControls ? 1 : 0,
          background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
          padding: "24px 16px 12px",
        }}
      >
        <input
          type="range" min={0} max={duration || 100} value={currentTime} step={0.1} onChange={seek}
          className="w-full mb-2"
          style={{ accentColor: "var(--yuvist-red)", height: 4, cursor: "pointer" }}
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="text-white hover:text-red-400 transition-colors">
              <Icon name={playing ? "Pause" : "Play"} size={22} />
            </button>
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-white hover:text-red-400 transition-colors">
                <Icon name={muted || volume === 0 ? "VolumeX" : "Volume2"} size={18} />
              </button>
              <input
                type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={setVol}
                style={{ width: 70, accentColor: "var(--yuvist-red)", cursor: "pointer" }}
              />
            </div>
            <span className="text-white text-xs opacity-80">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xs opacity-60 border border-white/20 px-2 py-0.5 rounded">
              {video.quality}
            </span>
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="text-white text-xs opacity-80 hover:opacity-100 border border-white/20 px-2 py-0.5 rounded transition-opacity"
              >
                {speed}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-8 right-0 yuvist-card py-1 z-50 min-w-[80px]">
                  {speeds.map(s => (
                    <button
                      key={s} onClick={() => changeSpeed(s)}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 transition-colors"
                      style={{ color: s === speed ? "var(--yuvist-red)" : "var(--yuvist-text)" }}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── VIDEO CARD ──────────────────────────────────────────────────────────────

function VideoCard({ video, onClick }: { video: Video; onClick: () => void }) {
  return (
    <div className="video-card" onClick={onClick}>
      <div className="video-thumb relative">
        {video.thumbnail ? (
          <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--yuvist-surface2)" }}>
            <Icon name="Play" size={40} style={{ color: "var(--yuvist-muted)" }} />
          </div>
        )}
        <span
          className="absolute bottom-2 right-2 text-white text-xs font-semibold px-1.5 py-0.5 rounded"
          style={{ background: "rgba(0,0,0,0.8)" }}
        >
          {video.duration || "0:00"}
        </span>
      </div>
      <div className="mt-2 flex gap-2">
        <Avatar src={video.authorAvatar} name={video.authorName} size={32} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight line-clamp-2" style={{ color: "var(--yuvist-text)" }}>
            {video.title}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--yuvist-muted)" }}>{video.authorName}</p>
          <p className="text-xs" style={{ color: "var(--yuvist-muted)" }}>
            {formatViews(video.views)} просм. · {timeAgo(video.uploadedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── UPLOAD MODAL ────────────────────────────────────────────────────────────

function UploadModal({
  currentUser, onClose, onUpload,
}: {
  currentUser: User; onClose: () => void; onUpload: (v: Video) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quality, setQuality] = useState("1080p");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbUrl, setThumbUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const durationRef = useRef("0:00");

  const handleVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setVideoFile(f);
    const url = URL.createObjectURL(f);
    setVideoUrl(url);
    const vid = document.createElement("video");
    vid.src = url;
    vid.onloadedmetadata = () => {
      const d = vid.duration;
      const h = Math.floor(d / 3600);
      const m = Math.floor((d % 3600) / 60);
      const s = Math.floor(d % 60);
      durationRef.current = h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        : `${m}:${String(s).padStart(2, "0")}`;
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    };
  };

  const handleThumb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setThumbFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setThumbUrl(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleSubmit = () => {
    if (!title.trim()) { setError("Введите название видео"); return; }
    if (!videoUrl) { setError("Загрузите видео файл"); return; }
    setLoading(true);

    const readFile = (file: File): Promise<string> =>
      new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });

    (async () => {
      const finalVideoUrl = videoFile ? await readFile(videoFile) : videoUrl;
      const finalThumb = thumbFile ? thumbUrl : null;

      const newVideo: Video = {
        id: generateId(),
        title: title.trim(),
        description: description.trim(),
        authorId: currentUser.id,
        authorName: currentUser.username,
        authorAvatar: currentUser.avatar,
        url: finalVideoUrl,
        thumbnail: finalThumb,
        views: 0,
        viewedBy: [],
        likes: [],
        dislikes: [],
        comments: [],
        duration: durationRef.current,
        uploadedAt: Date.now(),
        quality,
      };
      onUpload(newVideo);
      setLoading(false);
    })();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: "rgba(0,0,0,0.8)" }}
    >
      <div className="yuvist-card p-6 w-full max-w-lg mx-4 animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: "var(--yuvist-text)" }}>Загрузить видео</h2>
          <button onClick={onClose} style={{ color: "var(--yuvist-muted)" }} className="hover:text-white transition-colors">
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--yuvist-muted)" }}>
              Видео файл *
            </label>
            <label
              className="flex items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors hover:border-red-500"
              style={{
                borderColor: videoFile ? "var(--yuvist-red)" : "var(--yuvist-border)",
                padding: "20px", background: "var(--yuvist-surface2)",
              }}
            >
              <Icon name="Upload" size={22} style={{ color: videoFile ? "var(--yuvist-red)" : "var(--yuvist-muted)" }} />
              <span className="text-sm" style={{ color: videoFile ? "var(--yuvist-text)" : "var(--yuvist-muted)" }}>
                {videoFile ? videoFile.name : "Нажмите для выбора видео"}
              </span>
              <input type="file" accept="video/*" onChange={handleVideoFile} className="hidden" />
            </label>
          </div>

          <div>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--yuvist-muted)" }}>
              Превью (обложка)
            </label>
            <label
              className="flex items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors hover:border-red-500"
              style={{
                borderColor: thumbFile ? "var(--yuvist-red)" : "var(--yuvist-border)",
                padding: "14px", background: "var(--yuvist-surface2)",
              }}
            >
              {thumbUrl
                ? <img src={thumbUrl} className="w-16 h-10 object-cover rounded" alt="thumb" />
                : <Icon name="Image" size={20} style={{ color: "var(--yuvist-muted)" }} />
              }
              <span className="text-sm" style={{ color: thumbFile ? "var(--yuvist-text)" : "var(--yuvist-muted)" }}>
                {thumbFile ? thumbFile.name : "Загрузить обложку"}
              </span>
              <input type="file" accept="image/*" onChange={handleThumb} className="hidden" />
            </label>
          </div>

          <div>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--yuvist-muted)" }}>Название *</label>
            <input className="yuvist-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Введите название видео" />
          </div>

          <div>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--yuvist-muted)" }}>Описание</label>
            <textarea
              className="yuvist-input resize-none" rows={3}
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Расскажите о видео..."
            />
          </div>

          <div>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--yuvist-muted)" }}>Качество</label>
            <select className="yuvist-input" value={quality} onChange={e => setQuality(e.target.value)}>
              <option value="360p">360p</option>
              <option value="480p">480p</option>
              <option value="720p">720p HD</option>
              <option value="1080p">1080p Full HD</option>
              <option value="4K">4K Ultra HD</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button onClick={handleSubmit} disabled={loading} className="yuvist-btn w-full" style={{ opacity: loading ? 0.7 : 1 }}>
            {loading ? "Загрузка..." : "Опубликовать"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AUTH MODAL ──────────────────────────────────────────────────────────────

function AuthModal({ onAuth, onClose }: { onAuth: (u: User) => void; onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    setError("");
    const users: User[] = load(STORAGE_KEYS.users, []);

    if (mode === "register") {
      if (!username.trim() || !email.trim() || !password) { setError("Заполните все поля"); return; }
      if (password.length < 6) { setError("Пароль должен быть не менее 6 символов"); return; }
      if (password !== confirm) { setError("Пароли не совпадают"); return; }
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) { setError("Неверный формат email"); return; }
      if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
        setError("Этот логин уже занят"); return;
      }
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        setError("Этот email уже зарегистрирован"); return;
      }
      const newUser: User = {
        id: generateId(), username: username.trim(), email: email.trim(),
        password, avatar: null, bio: "", donateLink: "", createdAt: Date.now(),
      };
      save(STORAGE_KEYS.users, [...users, newUser]);
      onAuth(newUser);
    } else {
      if (!username.trim() || !password) { setError("Заполните все поля"); return; }
      const user = users.find(
        u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
      );
      if (!user) { setError("Неверный логин или пароль"); return; }
      onAuth(user);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: "rgba(0,0,0,0.85)" }}
    >
      <div className="yuvist-card p-7 w-full max-w-sm mx-4 animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-black" style={{ color: "var(--yuvist-red)", fontFamily: "Golos Text" }}>
                ЮВИСТ
              </span>
            </div>
            <p className="text-sm" style={{ color: "var(--yuvist-muted)" }}>
              {mode === "login" ? "Войдите в аккаунт" : "Создайте аккаунт"}
            </p>
          </div>
          <button onClick={onClose} style={{ color: "var(--yuvist-muted)" }}>
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: "var(--yuvist-surface2)" }}>
          {(["login", "register"] as const).map(m => (
            <button
              key={m} onClick={() => { setMode(m); setError(""); }}
              className="flex-1 py-2 rounded-md text-sm font-semibold transition-all"
              style={{
                background: mode === m ? "var(--yuvist-red)" : "transparent",
                color: mode === m ? "#fff" : "var(--yuvist-muted)",
              }}
            >
              {m === "login" ? "Войти" : "Регистрация"}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: "var(--yuvist-muted)" }}>Логин</label>
            <input
              className="yuvist-input" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="Введите логин" onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
          </div>
          {mode === "register" && (
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: "var(--yuvist-muted)" }}>Email</label>
              <input
                className="yuvist-input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com" onKeyDown={e => e.key === "Enter" && handleSubmit()}
              />
            </div>
          )}
          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: "var(--yuvist-muted)" }}>Пароль</label>
            <input
              className="yuvist-input" type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
          </div>
          {mode === "register" && (
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: "var(--yuvist-muted)" }}>
                Подтвердите пароль
              </label>
              <input
                className="yuvist-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleSubmit()}
              />
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={handleSubmit} className="yuvist-btn w-full mt-2">
            {mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── VIDEO PAGE ───────────────────────────────────────────────────────────────

function VideoPage({
  video: initialVideo, currentUser, allVideos, onUpdate, onChannelClick, onSponsor,
}: {
  video: Video; currentUser: User | null; allVideos: Video[];
  onUpdate: (v: Video) => void;
  onChannelClick: (authorId: string) => void;
  onSponsor: (authorId: string) => void;
}) {
  const [video, setVideo] = useState(initialVideo);
  const [commentText, setCommentText] = useState("");

  const handleUpdate = useCallback(
    (v: Video) => { setVideo(v); onUpdate(v); },
    [onUpdate]
  );

  useEffect(() => { setVideo(initialVideo); }, [initialVideo.id, initialVideo]);

  const toggleLike = () => {
    if (!currentUser) return;
    const uid = currentUser.id;
    let likes = [...video.likes];
    let dislikes = [...video.dislikes];
    if (likes.includes(uid)) {
      likes = likes.filter(x => x !== uid);
    } else {
      likes = [...likes, uid];
      dislikes = dislikes.filter(x => x !== uid);
    }
    handleUpdate({ ...video, likes, dislikes });
  };

  const toggleDislike = () => {
    if (!currentUser) return;
    const uid = currentUser.id;
    let likes = [...video.likes];
    let dislikes = [...video.dislikes];
    if (dislikes.includes(uid)) {
      dislikes = dislikes.filter(x => x !== uid);
    } else {
      dislikes = [...dislikes, uid];
      likes = likes.filter(x => x !== uid);
    }
    handleUpdate({ ...video, likes, dislikes });
  };

  const addComment = () => {
    if (!currentUser || !commentText.trim()) return;
    const c: Comment = {
      id: generateId(), userId: currentUser.id, username: currentUser.username,
      userAvatar: currentUser.avatar, text: commentText.trim(), createdAt: Date.now(),
    };
    handleUpdate({ ...video, comments: [c, ...video.comments] });
    setCommentText("");
  };

  const related = allVideos.filter(v => v.id !== video.id).slice(0, 8);

  return (
    <div className="flex gap-6 animate-fade-in">
      <div className="flex-1 min-w-0">
        <VideoPlayer video={video} currentUser={currentUser} onUpdate={handleUpdate} />

        <div className="mt-4">
          <h1 className="text-xl font-bold leading-snug" style={{ color: "var(--yuvist-text)" }}>
            {video.title}
          </h1>
          <div className="flex items-center justify-between mt-3 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onChannelClick(video.authorId)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <Avatar src={video.authorAvatar} name={video.authorName} size={38} />
                <div>
                  <p className="font-semibold text-sm" style={{ color: "var(--yuvist-text)" }}>{video.authorName}</p>
                  <p className="text-xs" style={{ color: "var(--yuvist-muted)" }}>{formatViews(video.views)} просмотров</p>
                </div>
              </button>
              <button
                onClick={() => onSponsor(video.authorId)}
                className="yuvist-btn-ghost flex items-center gap-1.5 text-sm"
                style={{ borderColor: "var(--yuvist-red)", color: "var(--yuvist-red)" }}
              >
                <Icon name="Heart" size={15} />
                Спонсировать
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleLike}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all"
                style={{
                  background: currentUser && video.likes.includes(currentUser.id)
                    ? "var(--yuvist-red)" : "var(--yuvist-surface2)",
                  color: currentUser && video.likes.includes(currentUser.id) ? "#fff" : "var(--yuvist-text)",
                  border: "1px solid var(--yuvist-border)",
                }}
              >
                <Icon name="ThumbsUp" size={15} />
                {video.likes.length}
              </button>
              <button
                onClick={toggleDislike}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all"
                style={{
                  background: currentUser && video.dislikes.includes(currentUser.id)
                    ? "#555" : "var(--yuvist-surface2)",
                  color: "var(--yuvist-text)",
                  border: "1px solid var(--yuvist-border)",
                }}
              >
                <Icon name="ThumbsDown" size={15} />
                {video.dislikes.length}
              </button>
            </div>
          </div>

          {video.description && (
            <div
              className="mt-3 p-3 rounded-xl text-sm leading-relaxed"
              style={{ background: "var(--yuvist-surface2)", color: "var(--yuvist-muted)" }}
            >
              {video.description}
            </div>
          )}

          <div className="mt-6">
            <h3 className="font-bold mb-4" style={{ color: "var(--yuvist-text)" }}>
              Комментарии · {video.comments.length}
            </h3>
            {currentUser ? (
              <div className="flex gap-3 mb-5">
                <Avatar src={currentUser.avatar} name={currentUser.username} size={34} />
                <div className="flex-1">
                  <input
                    className="yuvist-input text-sm" value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Напишите комментарий..."
                    onKeyDown={e => e.key === "Enter" && addComment()}
                  />
                  {commentText && (
                    <button onClick={addComment} className="yuvist-btn mt-2 text-sm py-1.5 px-4">
                      Отправить
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm mb-4" style={{ color: "var(--yuvist-muted)" }}>
                Войдите, чтобы оставить комментарий
              </p>
            )}
            <div className="space-y-4">
              {video.comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <Avatar src={c.userAvatar} name={c.username} size={32} />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold" style={{ color: "var(--yuvist-text)" }}>
                        {c.username}
                      </span>
                      <span className="text-xs" style={{ color: "var(--yuvist-muted)" }}>
                        {timeAgo(c.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: "var(--yuvist-text)", opacity: 0.85 }}>{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="w-80 flex-shrink-0 hidden lg:block">
        <p className="font-semibold mb-3 text-sm" style={{ color: "var(--yuvist-muted)" }}>Похожие видео</p>
        <div className="space-y-3">
          {related.map(v => (
            <div
              key={v.id}
              className="flex gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => onUpdate(v)}
            >
              <div
                className="rounded-lg overflow-hidden flex-shrink-0"
                style={{ width: 120, aspectRatio: "16/9", background: "var(--yuvist-surface2)" }}
              >
                {v.thumbnail
                  ? <img src={v.thumbnail} className="w-full h-full object-cover" alt={v.title} />
                  : <div className="w-full h-full flex items-center justify-center">
                      <Icon name="Play" size={20} style={{ color: "var(--yuvist-muted)" }} />
                    </div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold line-clamp-2 leading-snug" style={{ color: "var(--yuvist-text)" }}>
                  {v.title}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--yuvist-muted)" }}>{v.authorName}</p>
                <p className="text-xs" style={{ color: "var(--yuvist-muted)" }}>{formatViews(v.views)} просм.</p>
              </div>
            </div>
          ))}
          {related.length === 0 && <p className="text-sm" style={{ color: "var(--yuvist-muted)" }}>Видео пока нет</p>}
        </div>
      </div>
    </div>
  );
}

// ─── SPONSOR MODAL ────────────────────────────────────────────────────────────

function SponsorModal({ author, onClose }: { author: User | undefined; onClose: () => void }) {
  if (!author) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: "rgba(0,0,0,0.8)" }}
    >
      <div className="yuvist-card p-7 w-full max-w-sm mx-4 text-center animate-scale-in relative">
        <button onClick={onClose} className="absolute top-4 right-4" style={{ color: "var(--yuvist-muted)" }}>
          <Icon name="X" size={20} />
        </button>
        <div className="flex justify-center mb-3">
          <Icon name="Heart" size={40} style={{ color: "var(--yuvist-red)" }} />
        </div>
        <h2 className="text-lg font-bold mb-2" style={{ color: "var(--yuvist-text)" }}>
          Поддержать {author.username}
        </h2>
        {author.donateLink ? (
          <>
            <p className="text-sm mb-4" style={{ color: "var(--yuvist-muted)" }}>
              Отсканируйте QR-код или перейдите по ссылке для доната
            </p>
            <div
              className="p-4 rounded-xl mb-4 flex items-center justify-center"
              style={{ background: "var(--yuvist-surface2)" }}
            >
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(author.donateLink)}`}
                alt="QR"
                className="rounded-lg"
                style={{ width: 160, height: 160 }}
              />
            </div>
            <a
              href={author.donateLink}
              target="_blank" rel="noreferrer"
              className="yuvist-btn block w-full text-center"
            >
              Перейти к донату
            </a>
          </>
        ) : (
          <p className="text-sm" style={{ color: "var(--yuvist-muted)" }}>
            Автор не указал ссылку для доната
          </p>
        )}
        <button onClick={onClose} className="yuvist-btn-ghost w-full mt-3">Закрыть</button>
      </div>
    </div>
  );
}

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────

function SettingsPage({
  currentUser, theme, onThemeChange, onLogout, onDeleteAccount, onSwitchAccount, onUpdateUser,
}: {
  currentUser: User; theme: "dark" | "light"; onThemeChange: (t: "dark" | "light") => void;
  onLogout: () => void; onDeleteAccount: () => void; onSwitchAccount: () => void;
  onUpdateUser: (u: User) => void;
}) {
  const [donateLink, setDonateLink] = useState(currentUser.donateLink || "");
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveDonate = () => {
    onUpdateUser({ ...currentUser, donateLink });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-xl animate-fade-in">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--yuvist-text)" }}>Настройки</h1>

      <div className="space-y-4">
        <div className="yuvist-card p-5">
          <h3 className="font-semibold mb-3" style={{ color: "var(--yuvist-text)" }}>Тема оформления</h3>
          <div className="flex gap-3">
            {(["dark", "light"] as const).map(t => (
              <button
                key={t} onClick={() => onThemeChange(t)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: theme === t ? "var(--yuvist-red)" : "var(--yuvist-surface2)",
                  color: theme === t ? "#fff" : "var(--yuvist-text)",
                  border: `2px solid ${theme === t ? "var(--yuvist-red)" : "var(--yuvist-border)"}`,
                }}
              >
                <Icon name={t === "dark" ? "Moon" : "Sun"} size={16} />
                {t === "dark" ? "Тёмная" : "Светлая"}
              </button>
            ))}
          </div>
        </div>

        <div className="yuvist-card p-5">
          <h3 className="font-semibold mb-1" style={{ color: "var(--yuvist-text)" }}>
            Ссылка для доната (QR-код)
          </h3>
          <p className="text-xs mb-3" style={{ color: "var(--yuvist-muted)" }}>
            Вставьте ссылку — под вашими видео появится кнопка «Спонсировать»
          </p>
          <input
            className="yuvist-input mb-3" value={donateLink}
            onChange={e => setDonateLink(e.target.value)} placeholder="https://..."
          />
          <button onClick={saveDonate} className="yuvist-btn text-sm py-2 px-5">
            {saved ? "Сохранено ✓" : "Сохранить"}
          </button>
        </div>

        <div className="yuvist-card p-5">
          <h3 className="font-semibold mb-3" style={{ color: "var(--yuvist-text)" }}>Аккаунт</h3>
          <div className="space-y-2">
            <button onClick={onSwitchAccount} className="yuvist-btn-ghost w-full flex items-center gap-2 justify-center">
              <Icon name="RefreshCw" size={16} />
              Сменить аккаунт
            </button>
            <button onClick={onLogout} className="yuvist-btn-ghost w-full flex items-center gap-2 justify-center">
              <Icon name="LogOut" size={16} />
              Выйти из аккаунта
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center gap-2 justify-center px-4 py-2 rounded-xl font-medium text-sm transition-all"
                style={{
                  background: "rgba(229,57,53,0.1)", color: "var(--yuvist-red)",
                  border: "1px solid rgba(229,57,53,0.3)",
                }}
              >
                <Icon name="Trash2" size={16} />
                Удалить аккаунт
              </button>
            ) : (
              <div
                className="p-3 rounded-xl"
                style={{ background: "rgba(229,57,53,0.08)", border: "1px solid rgba(229,57,53,0.3)" }}
              >
                <p className="text-sm mb-3 text-center" style={{ color: "var(--yuvist-text)" }}>
                  Вы уверены? Это действие необратимо.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={onDeleteAccount}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold"
                    style={{ background: "var(--yuvist-red)", color: "#fff" }}
                  >
                    Удалить
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold"
                    style={{ background: "var(--yuvist-surface2)", color: "var(--yuvist-text)" }}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PROFILE EDITOR ───────────────────────────────────────────────────────────

function ProfileEditor({ user, onSave, onClose }: { user: User; onSave: (u: User) => void; onClose: () => void }) {
  const [bio, setBio] = useState(user.bio || "");
  const [avatar, setAvatar] = useState<string | null>(user.avatar);
  const [saved, setSaved] = useState(false);

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => setAvatar(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleSave = () => {
    onSave({ ...user, bio, avatar });
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: "rgba(0,0,0,0.8)" }}
    >
      <div className="yuvist-card p-6 w-full max-w-sm mx-4 animate-scale-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: "var(--yuvist-text)" }}>Редактор профиля</h2>
          <button onClick={onClose} style={{ color: "var(--yuvist-muted)" }}>
            <Icon name="X" size={20} />
          </button>
        </div>
        <div className="flex flex-col items-center mb-5">
          <label className="cursor-pointer group relative">
            <Avatar src={avatar} name={user.username} size={80} />
            <div
              className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: "rgba(0,0,0,0.6)" }}
            >
              <Icon name="Camera" size={22} style={{ color: "#fff" }} />
            </div>
            <input type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
          </label>
          <p className="text-xs mt-2" style={{ color: "var(--yuvist-muted)" }}>Нажмите для смены фото</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: "var(--yuvist-muted)" }}>Логин</label>
            <input className="yuvist-input" value={user.username} disabled style={{ opacity: 0.6 }} />
          </div>
          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: "var(--yuvist-muted)" }}>О себе</label>
            <textarea
              className="yuvist-input resize-none" rows={3}
              value={bio} onChange={e => setBio(e.target.value)} placeholder="Расскажите о себе..."
            />
          </div>
          <button onClick={handleSave} className="yuvist-btn w-full">
            {saved ? "Сохранено ✓" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CHANNEL PAGE ─────────────────────────────────────────────────────────────

function ChannelPage({
  authorId, allUsers, allVideos, currentUser, onVideoClick, onEditProfile, subscriptions, onToggleSub,
}: {
  authorId: string; allUsers: User[]; allVideos: Video[]; currentUser: User | null;
  onVideoClick: (v: Video) => void; onEditProfile: () => void;
  subscriptions: string[]; onToggleSub: (id: string) => void;
}) {
  const author = allUsers.find(u => u.id === authorId);
  const videos = allVideos.filter(v => v.authorId === authorId);
  const isOwn = currentUser?.id === authorId;
  const isSubbed = subscriptions.includes(authorId);

  if (!author) return <p style={{ color: "var(--yuvist-muted)" }}>Канал не найден</p>;

  return (
    <div className="animate-fade-in">
      <div
        className="rounded-2xl p-6 mb-6 flex items-center gap-5 flex-wrap"
        style={{ background: "var(--yuvist-surface)", border: "1px solid var(--yuvist-border)" }}
      >
        <Avatar src={author.avatar} name={author.username} size={80} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold" style={{ color: "var(--yuvist-text)" }}>{author.username}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--yuvist-muted)" }}>
            {videos.length} видео · зарегистрирован {timeAgo(author.createdAt)}
          </p>
          {author.bio && (
            <p className="text-sm mt-2" style={{ color: "var(--yuvist-text)", opacity: 0.75 }}>{author.bio}</p>
          )}
        </div>
        <div className="flex gap-2">
          {isOwn ? (
            <button onClick={onEditProfile} className="yuvist-btn-ghost flex items-center gap-2 text-sm">
              <Icon name="Pencil" size={15} />
              Редактировать профиль
            </button>
          ) : (
            <button
              onClick={() => onToggleSub(authorId)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: isSubbed ? "var(--yuvist-surface2)" : "var(--yuvist-red)",
                color: isSubbed ? "var(--yuvist-text)" : "#fff",
                border: `1px solid ${isSubbed ? "var(--yuvist-border)" : "transparent"}`,
              }}
            >
              <Icon name={isSubbed ? "BellOff" : "Bell"} size={15} />
              {isSubbed ? "Отписаться" : "Подписаться"}
            </button>
          )}
        </div>
      </div>

      <h2 className="font-semibold mb-4" style={{ color: "var(--yuvist-text)" }}>Видео канала</h2>
      {videos.length === 0 ? (
        <div className="py-12 text-center">
          <Icon name="Video" size={48} style={{ color: "var(--yuvist-muted)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--yuvist-muted)" }}>На этом канале пока нет видео</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map(v => <VideoCard key={v.id} video={v} onClick={() => onVideoClick(v)} />)}
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

type Page =
  | "home"
  | "subscriptions"
  | "history"
  | "settings"
  | { type: "video"; video: Video }
  | { type: "channel"; authorId: string };

export default function Index() {
  const [users, setUsers] = useState<User[]>(() => load(STORAGE_KEYS.users, []));
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const uid: string | null = load(STORAGE_KEYS.currentUser, null);
    if (!uid) return null;
    const storedUsers: User[] = load(STORAGE_KEYS.users, []);
    return storedUsers.find(u => u.id === uid) || null;
  });
  const [videos, setVideos] = useState<Video[]>(() => load(STORAGE_KEYS.videos, []));
  const [theme, setTheme] = useState<"dark" | "light">(() => load(STORAGE_KEYS.theme, "dark"));
  const [subscriptions, setSubscriptions] = useState<string[]>(() => load(STORAGE_KEYS.subscriptions, []));
  const [history, setHistory] = useState<string[]>(() => load(STORAGE_KEYS.history, []));
  const [page, setPage] = useState<Page>("home");
  const [showAuth, setShowAuth] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSponsor, setShowSponsor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("light-theme", theme === "light");
    save(STORAGE_KEYS.theme, theme);
  }, [theme]);

  useEffect(() => { save(STORAGE_KEYS.users, users); }, [users]);
  useEffect(() => { save(STORAGE_KEYS.videos, videos); }, [videos]);
  useEffect(() => { save(STORAGE_KEYS.subscriptions, subscriptions); }, [subscriptions]);
  useEffect(() => { save(STORAGE_KEYS.history, history); }, [history]);

  const handleAuth = (user: User) => {
    setCurrentUser(user);
    save(STORAGE_KEYS.currentUser, user.id);
    setShowAuth(false);
    setPage("home");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    save(STORAGE_KEYS.currentUser, null);
    setPage("home");
  };

  const handleDeleteAccount = () => {
    if (!currentUser) return;
    setUsers(prev => prev.filter(u => u.id !== currentUser.id));
    setVideos(prev => prev.filter(v => v.authorId !== currentUser.id));
    setCurrentUser(null);
    save(STORAGE_KEYS.currentUser, null);
    setPage("home");
  };

  const handleUpdateUser = (updated: User) => {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    setCurrentUser(updated);
    save(STORAGE_KEYS.currentUser, updated.id);
  };

  const handleUpload = (v: Video) => {
    setVideos(prev => [v, ...prev]);
    setShowUpload(false);
    setPage({ type: "video", video: v });
  };

  const handleVideoUpdate = useCallback((updated: Video) => {
    setVideos(prev => prev.map(v => v.id === updated.id ? updated : v));
    setPage(prev => {
      if (typeof prev === "object" && "type" in prev && prev.type === "video" && prev.video.id === updated.id) {
        return { type: "video", video: updated };
      }
      return prev;
    });
  }, []);

  const handleVideoClick = (v: Video) => {
    setHistory(prev => [v.id, ...prev.filter(id => id !== v.id)].slice(0, 100));
    setPage({ type: "video", video: v });
    setSearchActive(false);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleSub = (authorId: string) => {
    setSubscriptions(prev =>
      prev.includes(authorId) ? prev.filter(id => id !== authorId) : [...prev, authorId]
    );
  };

  const navTo = (p: Page) => {
    setPage(p);
    setSidebarOpen(false);
    setSearchActive(false);
    window.scrollTo({ top: 0 });
  };

  const searchResults = searchQuery.trim()
    ? videos.filter(
        v =>
          v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.authorName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const subVideos = videos.filter(v => subscriptions.includes(v.authorId));
  const historyVideos = history
    .map(id => videos.find(v => v.id === id))
    .filter(Boolean) as Video[];

  const sponsorAuthor = showSponsor ? users.find(u => u.id === showSponsor) : undefined;

  const navItems = [
    { id: "home", icon: "Home", label: "Главная" },
    { id: "subscriptions", icon: "Bell", label: "Подписки" },
    { id: "history", icon: "Clock", label: "История" },
    { id: "settings", icon: "Settings", label: "Настройки" },
  ];

  const currentPageId = typeof page === "string" ? page : page.type;

  return (
    <div style={{ minHeight: "100vh", background: "var(--yuvist-surface2)" }}>
      {/* TOPBAR */}
      <header className="fixed top-0 left-0 right-0 z-40 nav-glass" style={{ height: 56 }}>
        <div className="flex items-center justify-between h-full px-4 gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: "var(--yuvist-text)" }}
            >
              <Icon name="Menu" size={22} />
            </button>
            <button onClick={() => navTo("home")} className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-xs"
                style={{ background: "var(--yuvist-red)" }}
              >
                Ю
              </div>
              <span className="font-black text-lg tracking-tight" style={{ color: "var(--yuvist-text)", fontFamily: "Golos Text" }}>
                ЮВИСТ
              </span>
            </button>
          </div>

          <div className="flex-1 max-w-xl hidden sm:flex items-center gap-2">
            <div className="relative flex-1">
              <Icon
                name="Search" size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--yuvist-muted)" }}
              />
              <input
                className="yuvist-input pl-9 text-sm py-2"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setSearchActive(e.target.value.trim().length > 0);
                }}
                placeholder="Поиск видео..."
                onKeyDown={e => e.key === "Escape" && setSearchActive(false)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUser ? (
              <>
                <button onClick={() => setShowUpload(true)} className="yuvist-btn flex items-center gap-1.5 text-sm py-2 px-3">
                  <Icon name="Plus" size={16} />
                  <span className="hidden sm:inline">Загрузить</span>
                </button>
                <button
                  onClick={() => navTo({ type: "channel", authorId: currentUser.id })}
                  className="hover:opacity-80 transition-opacity"
                >
                  <Avatar src={currentUser.avatar} name={currentUser.username} size={32} />
                </button>
              </>
            ) : (
              <button onClick={() => setShowAuth(true)} className="yuvist-btn text-sm py-2 px-4">
                Войти
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile search */}
      <div
        className="fixed z-30 sm:hidden px-4 py-2"
        style={{ top: 56, left: 0, right: 0, background: "var(--yuvist-surface2)", borderBottom: "1px solid var(--yuvist-border)" }}
      >
        <div className="relative">
          <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--yuvist-muted)" }} />
          <input
            className="yuvist-input pl-9 text-sm py-2"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setSearchActive(e.target.value.trim().length > 0);
            }}
            placeholder="Поиск видео..."
          />
        </div>
      </div>

      {/* SIDEBAR */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed left-0 z-30 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{
          top: 56, bottom: 0, width: 220,
          background: "var(--yuvist-surface)",
          borderRight: "1px solid var(--yuvist-border)",
          padding: "12px 8px", overflowY: "auto",
        }}
      >
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => navTo(item.id as Page)}
            className={`sidebar-item ${typeof page === "string" && page === item.id ? "active" : ""}`}
          >
            <Icon name={item.icon as "Home"} size={20} />
            {item.label}
          </button>
        ))}

        {currentUser && (
          <>
            <div className="my-2" style={{ height: 1, background: "var(--yuvist-border)" }} />
            <button
              onClick={() => navTo({ type: "channel", authorId: currentUser.id })}
              className={`sidebar-item ${typeof page === "object" && "type" in page && page.type === "channel" && page.authorId === currentUser.id ? "active" : ""}`}
            >
              <Avatar src={currentUser.avatar} name={currentUser.username} size={20} />
              Мой канал
            </button>
          </>
        )}

        {subscriptions.length > 0 && (
          <>
            <div className="my-2" style={{ height: 1, background: "var(--yuvist-border)" }} />
            <p className="px-3 py-1 text-xs font-semibold uppercase" style={{ color: "var(--yuvist-muted)" }}>
              Подписки
            </p>
            {subscriptions.map(sid => {
              const sub = users.find(u => u.id === sid);
              if (!sub) return null;
              return (
                <button
                  key={sid}
                  onClick={() => navTo({ type: "channel", authorId: sid })}
                  className="sidebar-item"
                >
                  <Avatar src={sub.avatar} name={sub.username} size={20} />
                  {sub.username}
                </button>
              );
            })}
          </>
        )}
      </aside>

      {/* MAIN */}
      <main className="lg:pl-56" style={{ paddingTop: 72 }}>
        <div className="p-4 sm:p-6 sm:pt-4 max-w-7xl">

          {/* Search results */}
          {searchActive && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold" style={{ color: "var(--yuvist-text)" }}>
                  Результаты: «{searchQuery}»
                </h2>
                <button
                  onClick={() => { setSearchActive(false); setSearchQuery(""); }}
                  style={{ color: "var(--yuvist-muted)" }}
                >
                  <Icon name="X" size={20} />
                </button>
              </div>
              {searchResults.length === 0 ? (
                <div className="py-16 text-center">
                  <Icon name="SearchX" size={48} style={{ color: "var(--yuvist-muted)", margin: "0 auto 12px" }} />
                  <p style={{ color: "var(--yuvist-muted)" }}>Ничего не найдено</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {searchResults.map(v => <VideoCard key={v.id} video={v} onClick={() => handleVideoClick(v)} />)}
                </div>
              )}
            </div>
          )}

          {!searchActive && (
            <>
              {/* HOME */}
              {currentPageId === "home" && (
                <div className="animate-fade-in">
                  <h2 className="text-lg font-bold mb-5" style={{ color: "var(--yuvist-text)" }}>Главная</h2>
                  {videos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <div
                        className="w-24 h-24 rounded-full flex items-center justify-center mb-5"
                        style={{ background: "var(--yuvist-surface)" }}
                      >
                        <Icon name="Play" size={40} style={{ color: "var(--yuvist-red)" }} />
                      </div>
                      <h3 className="text-2xl font-bold mb-2" style={{ color: "var(--yuvist-text)" }}>
                        Видео пока нет
                      </h3>
                      <p className="text-sm mb-6" style={{ color: "var(--yuvist-muted)" }}>
                        Станьте первым! Загрузите своё видео на ЮВИСТ
                      </p>
                      {currentUser ? (
                        <button onClick={() => setShowUpload(true)} className="yuvist-btn flex items-center gap-2">
                          <Icon name="Upload" size={18} />
                          Загрузить первое видео
                        </button>
                      ) : (
                        <button onClick={() => setShowAuth(true)} className="yuvist-btn">
                          Войти и загрузить
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {videos.map(v => <VideoCard key={v.id} video={v} onClick={() => handleVideoClick(v)} />)}
                    </div>
                  )}
                </div>
              )}

              {/* SUBSCRIPTIONS */}
              {currentPageId === "subscriptions" && (
                <div className="animate-fade-in">
                  <h2 className="text-lg font-bold mb-5" style={{ color: "var(--yuvist-text)" }}>Подписки</h2>
                  {!currentUser ? (
                    <div className="flex flex-col items-center py-16 text-center">
                      <Icon name="Bell" size={48} style={{ color: "var(--yuvist-muted)", marginBottom: 12 }} />
                      <p className="mb-4" style={{ color: "var(--yuvist-muted)" }}>
                        Войдите, чтобы видеть видео от каналов, на которые вы подписаны
                      </p>
                      <button onClick={() => setShowAuth(true)} className="yuvist-btn">Войти</button>
                    </div>
                  ) : subVideos.length === 0 ? (
                    <div className="py-16 text-center">
                      <Icon name="Bell" size={48} style={{ color: "var(--yuvist-muted)", margin: "0 auto 12px" }} />
                      <p style={{ color: "var(--yuvist-muted)" }}>Вы ещё ни на кого не подписаны</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {subVideos.map(v => <VideoCard key={v.id} video={v} onClick={() => handleVideoClick(v)} />)}
                    </div>
                  )}
                </div>
              )}

              {/* HISTORY */}
              {currentPageId === "history" && (
                <div className="animate-fade-in">
                  <h2 className="text-lg font-bold mb-5" style={{ color: "var(--yuvist-text)" }}>История просмотров</h2>
                  {historyVideos.length === 0 ? (
                    <div className="py-16 text-center">
                      <Icon name="Clock" size={48} style={{ color: "var(--yuvist-muted)", margin: "0 auto 12px" }} />
                      <p style={{ color: "var(--yuvist-muted)" }}>История пуста</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {historyVideos.map(v => <VideoCard key={v.id} video={v} onClick={() => handleVideoClick(v)} />)}
                    </div>
                  )}
                </div>
              )}

              {/* SETTINGS */}
              {currentPageId === "settings" && (
                currentUser ? (
                  <SettingsPage
                    currentUser={currentUser}
                    theme={theme}
                    onThemeChange={setTheme}
                    onLogout={handleLogout}
                    onDeleteAccount={handleDeleteAccount}
                    onSwitchAccount={() => { handleLogout(); setTimeout(() => setShowAuth(true), 100); }}
                    onUpdateUser={handleUpdateUser}
                  />
                ) : (
                  <div className="flex flex-col items-center py-16 text-center">
                    <Icon name="Settings" size={48} style={{ color: "var(--yuvist-muted)", marginBottom: 12 }} />
                    <p className="mb-4" style={{ color: "var(--yuvist-muted)" }}>Войдите для доступа к настройкам</p>
                    <button onClick={() => setShowAuth(true)} className="yuvist-btn">Войти</button>
                  </div>
                )
              )}

              {/* VIDEO PAGE */}
              {typeof page === "object" && "type" in page && page.type === "video" && (
                <VideoPage
                  video={videos.find(v => v.id === page.video.id) || page.video}
                  currentUser={currentUser}
                  allVideos={videos}
                  onUpdate={handleVideoUpdate}
                  onChannelClick={aid => navTo({ type: "channel", authorId: aid })}
                  onSponsor={aid => setShowSponsor(aid)}
                />
              )}

              {/* CHANNEL PAGE */}
              {typeof page === "object" && "type" in page && page.type === "channel" && (
                <ChannelPage
                  authorId={page.authorId}
                  allUsers={users}
                  allVideos={videos}
                  currentUser={currentUser}
                  onVideoClick={handleVideoClick}
                  onEditProfile={() => setShowProfile(true)}
                  subscriptions={subscriptions}
                  onToggleSub={handleToggleSub}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* MODALS */}
      {showAuth && <AuthModal onAuth={handleAuth} onClose={() => setShowAuth(false)} />}
      {showUpload && currentUser && (
        <UploadModal currentUser={currentUser} onClose={() => setShowUpload(false)} onUpload={handleUpload} />
      )}
      {showProfile && currentUser && (
        <ProfileEditor user={currentUser} onSave={handleUpdateUser} onClose={() => setShowProfile(false)} />
      )}
      {showSponsor && <SponsorModal author={sponsorAuthor} onClose={() => setShowSponsor(null)} />}
    </div>
  );
}