"use client";

import * as D from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Kbd } from "@/components/ui/badge";
import { searchOrg, type SearchHit } from "@/features/search/actions";
import { cn } from "@/lib/utils";
import { useOrg } from "./org-provider";

const OPEN_EVENT = "mso:open-search";
export function openSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const SCOPES = ["All", "Projects", "Tasks", "Issues", "Clients", "Documents", "People"] as const;
type Scope = (typeof SCOPES)[number];

/** Ctrl/⌘ K. Debounced 300 ms; queries run on the server, scoped to the current org. */
export function CommandPalette() {
  const { org } = useOrg();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("All");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const requestId = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      if (query.trim().length < 2) {
        setHits([]);
        return;
      }
      startTransition(async () => {
        const result = await searchOrg(org.slug, query);
        if (id === requestId.current) {
          setHits(result);
          setActive(0);
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, org.slug]);

  const visible = useMemo(() => (scope === "All" ? hits : hits.filter((h) => h.group === scope)), [hits, scope]);
  const groups = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const h of visible) map.set(h.group, [...(map.get(h.group) ?? []), h]);
    return [...map.entries()];
  }, [visible]);

  function choose(hit: SearchHit | undefined) {
    if (!hit) return;
    setOpen(false);
    router.push(hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, visible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(visible[active]);
    } else if (e.key === "Tab") {
      e.preventDefault();
      setScope((s) => SCOPES[(SCOPES.indexOf(s) + (e.shiftKey ? SCOPES.length - 1 : 1)) % SCOPES.length]);
      setActive(0);
    }
  }

  let flatIndex = -1;
  return (
    <D.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(""); }}>
      <D.Portal>
        <D.Overlay className="animate-fade fixed inset-0 z-40 bg-[rgb(24_24_28/0.32)]" />
        <D.Content
          aria-describedby={undefined}
          onKeyDown={onKeyDown}
          className="animate-pop fixed inset-x-0 top-0 z-50 flex max-h-dvh flex-col overflow-hidden bg-surface outline-none lg:top-24 lg:left-1/2 lg:w-[640px] lg:-translate-x-1/2 lg:rounded-xl lg:border lg:border-line lg:shadow-dialog"
        >
          <D.Title className="sr-only">Search {org.name}</D.Title>
          <label className="flex h-14 items-center gap-3 border-b border-line-soft px-4.5">
            <Search aria-hidden className="size-[18px] text-ink-3" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects, tasks, issues…"
              aria-label="Search"
              role="combobox"
              aria-expanded={visible.length > 0}
              aria-controls="search-results"
              className="grow bg-transparent text-[16px] outline-none placeholder:text-ink-5"
            />
            <span className="rounded bg-subtle px-2 py-0.5 text-xs whitespace-nowrap text-ink-3 max-sm:hidden">in {org.name}</span>
          </label>
          <div role="tablist" aria-label="Result type" className="flex gap-1 overflow-x-auto border-b border-line-soft px-3 py-2">
            {SCOPES.map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={scope === s}
                onClick={() => { setScope(s); setActive(0); }}
                className={cn("h-[26px] shrink-0 rounded-[5px] px-2.5 text-[12.5px]", scope === s ? "bg-muted font-medium text-ink" : "text-ink-3 hover:bg-subtle")}
              >
                {s}
              </button>
            ))}
          </div>
          <div id="search-results" role="listbox" aria-label="Results" className="min-h-0 overflow-y-auto p-1.5">
            {query.trim().length < 2 ? (
              <p className="px-3 py-6 text-center text-sm text-ink-4">Type at least 2 characters.</p>
            ) : pending && hits.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-ink-4">Searching {org.name}…</p>
            ) : groups.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-ink-4">No results for “{query}”.</p>
            ) : (
              groups.map(([group, items]) => (
                <div key={group}>
                  <p className="px-2.5 pt-2.5 pb-1 text-2xs font-medium text-ink-4">{group}</p>
                  {items.map((h) => {
                    flatIndex += 1;
                    const i = flatIndex;
                    return (
                      <button
                        key={h.id}
                        role="option"
                        aria-selected={i === active}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => choose(h)}
                        className={cn("flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left max-lg:h-12", i === active && "bg-accent-soft")}
                      >
                        {h.key ? <span className="font-mono text-2xs text-ink-4">{h.key}</span> : null}
                        <span className="min-w-0 grow truncate">{h.title}</span>
                        <span className="text-xs whitespace-nowrap text-ink-4 max-sm:hidden">{h.meta}</span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          <div className="hidden h-[38px] items-center gap-4 border-t border-line-soft bg-sunken px-4 text-xs text-ink-4 lg:flex">
            <span><Kbd>↑↓</Kbd> move</span>
            <span><Kbd>↵</Kbd> open</span>
            <span><Kbd>Tab</Kbd> filter type</span>
            <span className="grow" />
            <span><Kbd>Esc</Kbd> close</span>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
