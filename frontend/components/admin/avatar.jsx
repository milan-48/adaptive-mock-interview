import Image from "next/image";
import { initialsFromUser } from "@/lib/auth";

export default function Avatar({ user, className = "" }) {
  if (user?.avatarUrl) {
    return (
      <Image
        src={user.avatarUrl}
        alt={user.name || user.email || "avatar"}
        width={40}
        height={40}
        unoptimized
        className={`h-10 w-10 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 ${className}`}
    >
      {initialsFromUser(user)}
    </div>
  );
}
