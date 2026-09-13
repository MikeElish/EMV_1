import { CartProvider } from "@/components/shop/CartProvider";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { companyInfo } from "@/content/company";

// Sets #shop-root's data-shop-theme before paint, from the visitor's saved
// choice (defaulting to dark when nothing's saved yet) -- avoids a flash of
// the wrong theme on a full page load. Note: this only runs on a hard
// navigation, since inline scripts inserted via React/RSC don't execute on
// client-side route transitions -- ThemeToggle's layout effect is what
// re-applies the saved theme when the shop layout mounts via SPA nav.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('shop-theme');if(t!=='light'&&t!=='dark'){t='dark';}document.getElementById('shop-root').setAttribute('data-shop-theme',t);}catch(e){}})();`;

export default function ShopLayout({ children }: LayoutProps<"/shop">) {
  return (
    <CartProvider>
      <div
        id="shop-root"
        data-shop-theme="dark"
        suppressHydrationWarning
        className="flex min-h-full flex-col bg-background text-foreground"
      >
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />

        <ShopHeader />

        <main className="flex-1">{children}</main>

        <footer className="border-t border-foreground/10">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-foreground/60">
            <p>EMV Запчасти — запчасти для спецтехники</p>
            <p>
              {companyInfo.legalName} · ИНН {companyInfo.inn}
            </p>
            <p>{companyInfo.address}</p>
            <p>
              <a href={`tel:${companyInfo.phoneHref}`} className="hover:text-foreground">
                {companyInfo.phone}
              </a>{" "}
              ·{" "}
              <a href={`mailto:${companyInfo.email}`} className="hover:text-foreground">
                {companyInfo.email}
              </a>
            </p>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
