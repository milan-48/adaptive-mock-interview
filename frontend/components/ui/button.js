export default function Button({ children, variant = "primary", className = "", ...props }) {
  const variantClass =
    variant === "secondary"
      ? "btn-secondary"
      : variant === "ghost"
        ? "btn-ghost"
        : "btn-primary";

  return (
    <button className={`btn-base ${variantClass} ${className}`} {...props}>
      {children}
    </button>
  );
}
