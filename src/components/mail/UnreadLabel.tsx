/** «Входящие (3)» in bold while there are unread letters, plain otherwise. */
export function UnreadLabel({ label, count }: { label: string; count: number | undefined }) {
  if (!count) return <>{label}</>;
  return (
    <span className="font-bold text-foreground">
      {label} ({count})
    </span>
  );
}
