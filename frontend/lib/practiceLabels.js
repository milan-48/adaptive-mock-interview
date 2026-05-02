/** @param {string} type */
export function interviewTypeLabel(type) {
  const key = String(type || "").toLowerCase();
  const map = {
    technical: "Technical",
    behavioral: "Behavioral",
    system_design: "System design",
  };
  return map[key] || type || "Practice";
}
