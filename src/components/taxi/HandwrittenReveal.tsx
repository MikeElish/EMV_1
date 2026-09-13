import { Marck_Script } from "next/font/google";

const handwritten = Marck_Script({
  subsets: ["cyrillic", "latin"],
  weight: "400",
});

export function HandwrittenReveal({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={`taxi-handwrite-wrap ${className ?? ""}`}>
      <span className={`taxi-handwrite-text ${handwritten.className}`}>
        {text}
      </span>
      <span className="taxi-handwrite-pen" aria-hidden="true" />
    </span>
  );
}
