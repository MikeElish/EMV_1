import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import { MetrikaPageViews } from "@/components/MetrikaPageViews";
import { METRIKA_ID, SITE_URL } from "@/lib/site";
import { EmailVerificationGate } from "@/components/EmailVerificationGate";
import { PersonalDataConsentGate } from "@/components/PersonalDataConsentGate";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "EMV",
  description: "EMV — такси и запчасти для спецтехники",
  openGraph: { siteName: "EMV", locale: "ru_RU", type: "website" },
  // Codes from Яндекс.Вебмастер / Google Search Console (public by design).
  verification: {
    yandex: "d7469e368887bcdd",
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`(function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=105596920', 'ym');

          ym(${METRIKA_ID}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});

          // Goals «phone» / «email»: a tap on the phone number or the address.
          document.addEventListener('click', function (e) {
            var a = e.target && e.target.closest && e.target.closest('a[href^="tel:"], a[href^="mailto:"]');
            if (a) ym(${METRIKA_ID}, 'reachGoal', a.getAttribute('href').indexOf('tel:') === 0 ? 'phone' : 'email');
          }, true);`}
        </Script>
        <Suspense>
          <MetrikaPageViews />
        </Suspense>
        <noscript>
          <div>
            <img src="https://mc.yandex.ru/watch/105596920" style={{ position: "absolute", left: "-9999px" }} alt="" />
          </div>
        </noscript>
        {children}
        <EmailVerificationGate />
        {/* After the e-mail one, so it opens on top: consent comes first. */}
        <PersonalDataConsentGate />
      </body>
    </html>
  );
}
