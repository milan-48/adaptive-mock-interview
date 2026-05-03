/** Single system admin — only this email may have role `admin`. */
export function getSuperAdminEmail() {
  return String(process.env.SUPER_ADMIN_EMAIL || "admin@gmail.com")
    .trim()
    .toLowerCase();
}
