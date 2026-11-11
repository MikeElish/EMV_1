"use client";

import { Component, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useWindowMinimization } from "@/components/WindowMinimizationProvider";

type PageEntry = { pathname: string; children: ReactNode };
type CacheProps = {
  pathname: string;
  persistentPaths: string[];
  children: ReactNode;
};
type CacheState = { activePath: string; pages: PageEntry[] };

class AdminPageCache extends Component<CacheProps, CacheState> {
  state: CacheState = {
    activePath: this.props.pathname,
    pages: [{ pathname: this.props.pathname, children: this.props.children }],
  };

  static getDerivedStateFromProps(props: CacheProps, state: CacheState): Partial<CacheState> | null {
    const retained = state.pages.filter((page) => props.persistentPaths.includes(page.pathname));
    const cachedActive = state.pages.find((page) => page.pathname === props.pathname);
    const active =
      state.activePath !== props.pathname &&
      props.persistentPaths.includes(props.pathname) &&
      cachedActive
        ? cachedActive
        : { pathname: props.pathname, children: props.children };
    const pages = [...retained.filter((page) => page.pathname !== active.pathname), active];
    if (
      state.activePath === props.pathname &&
      state.pages.length === pages.length &&
      state.pages.every((page, index) => page.pathname === pages[index].pathname && page.children === pages[index].children)
    ) {
      return null;
    }
    return { activePath: props.pathname, pages };
  }

  render() {
    return this.state.pages.map((page) => {
      const active = page.pathname === this.props.pathname;
      return (
        <div
          key={page.pathname}
          hidden={!active}
          aria-hidden={!active}
          inert={!active}
        >
          {page.children}
        </div>
      );
    });
  }
}

export function PersistentAdminPages({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { persistentPaths } = useWindowMinimization();
  return <AdminPageCache pathname={pathname} persistentPaths={persistentPaths}>{children}</AdminPageCache>;
}
