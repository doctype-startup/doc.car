"use client";

export default function ConfirmSubmitButton({
  confirmText,
  className,
  children,
}: {
  confirmText: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmText)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
