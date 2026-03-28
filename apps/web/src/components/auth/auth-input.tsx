type AuthInputProps = {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  value: string;
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

export function AuthInput({
  id,
  label,
  type = "text",
  value,
  placeholder,
  error,
  onChange,
  onBlur,
}: AuthInputProps) {
  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block text-xl font-medium text-white">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={`w-full rounded-2xl border bg-[#171a24] px-5 py-4 text-base text-white outline-none transition-colors placeholder:text-[#5f6785] focus:border-[var(--accent)]/70 ${
          error ? "border-red-500/60" : "border-white/8"
        }`}
      />
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
