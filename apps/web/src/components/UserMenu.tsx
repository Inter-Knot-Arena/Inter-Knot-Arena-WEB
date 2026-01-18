import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

export default function UserMenu() {
  const { user, isAuthed, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!isAuthed || !user) {
    return (
      <div className="flex items-center gap-2">
        <Link className="ghost-button" to="/signin">
          Sign in
        </Link>
        <Link className="ghost-button" to="/signin?mode=register">
          Create account
        </Link>
      </div>
    );
  }

  const initials = user.displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="avatar-button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user.displayName}
      >
        <Avatar className="h-10 w-10">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.displayName} /> : null}
          <AvatarFallback className="bg-ika-700 text-ink-900">{initials}</AvatarFallback>
        </Avatar>
      </button>
      {open ? (
        <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-border bg-ika-800/95 p-2 shadow-card">
          <Link
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ika-700/60 hover:text-ink-900"
            to={`/profile/${user.id}`}
            onClick={() => setOpen(false)}
          >
            <UserIcon className="h-4 w-4" />
            Profile
          </Link>
          <Link
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ika-700/60 hover:text-ink-900"
            to="/settings"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ika-700/60 hover:text-ink-900"
            onClick={async () => {
              await logout();
              setOpen(false);
              navigate("/");
            }}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
