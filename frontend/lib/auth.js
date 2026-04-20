export function isStaffRole(role) {
  return role === "admin" || role === "staff";
}

export function initialsFromUser(user) {
  const name = String(user?.name || "").trim();
  if (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }
  return String(user?.email || "U").slice(0, 1).toUpperCase();
}
